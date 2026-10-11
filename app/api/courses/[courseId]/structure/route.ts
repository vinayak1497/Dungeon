import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function ownedCourse(courseId: string, userId: string) {
  const sb = createServiceClient();
  const { data } = await sb.from("courses").select("id,title,code,semester,exam_date,syllabus_status").eq("id", courseId).eq("owner_id", userId).maybeSingle();
  return data;
}

// Full course structure for mapping review + workspace.
export async function GET(_req: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const course = await ownedCourse(params.courseId, user.id);
  if (!course) return err("not_found", "Course not found.", 404);

  const sb = createServiceClient();
  const [{ data: modules }, { data: concepts }] = await Promise.all([
    sb.from("modules").select("id,title,position,status").eq("course_id", course.id).order("position"),
    sb.from("concepts").select("id,module_id,title,status").eq("course_id", course.id),
  ]);
  // Course-scoped resources: linked rows + legacy rows stored under this
  // course's prefix (backfilled to course_id when seen).
  const { data: linkedRes } = await sb.from("resources").select("id,filename,mime,bytes,kind,scope,status,storage_path,created_at").eq("owner_id", user.id).eq("course_id", course.id).order("created_at", { ascending: false }).limit(100);
  const { data: legacyRes } = await sb.from("resources").select("id,filename,mime,bytes,kind,scope,status,storage_path,created_at").eq("owner_id", user.id).is("course_id", null).like("storage_path", `%/${course.id}/%`).limit(30);
  const resources = [...(linkedRes ?? []), ...((legacyRes ?? []) as typeof linkedRes ?? [])];
  if ((legacyRes ?? []).length > 0) {
    await sb.from("resources").update({ course_id: course.id }).eq("owner_id", user.id).is("course_id", null).like("storage_path", `%/${course.id}/%`);
  }
  const modIds = ((modules ?? []) as { id: string }[]).map((m) => m.id);
  const { data: assigns } = modIds.length > 0
    ? await sb.from("resource_module_assignments").select("id,resource_id,module_id,confidence,state").in("module_id", modIds)
    : { data: [] as unknown[] };

  return NextResponse.json({ course, modules: modules ?? [], concepts: concepts ?? [], resources: resources ?? [], assignments: assigns ?? [] });
}

type ModuleEdit = { id?: string; title: string; position: number; topics: { id?: string; title: string }[] };

// Saves reviewed structure: rename/reorder modules, edit topics, confirm.
// Never invents modules here — only persists what the student sends.
export async function PUT(req: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const course = await ownedCourse(params.courseId, user.id);
  if (!course) return err("not_found", "Course not found.", 404);
  if ((course as { syllabus_status?: string }).syllabus_status === "confirmed") {
    // Edits after confirmation are allowed but stay explicit student edits.
  }

  let body: { modules?: ModuleEdit[]; confirm?: boolean; assignments?: { resource_id: string; module_id: string }[] };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  const edits = (body.modules ?? []).slice(0, 30);
  for (const m of edits) {
    if (!m.title?.trim()) return err("bad_request", "Module titles cannot be empty.");
  }

  const sb = createServiceClient();
  const { data: existing } = await sb.from("modules").select("id").eq("course_id", course.id);
  const existingIds = new Set((existing ?? []).map((m) => m.id));
  const keepModuleIds = new Set<string>();
  const idMap = new Map<string, string>(); // temp client id -> real id

  for (const m of edits) {
    const title = m.title.trim().slice(0, 160);
    if (m.id && existingIds.has(m.id)) {
      await sb.from("modules").update({ title, position: m.position }).eq("id", m.id);
      keepModuleIds.add(m.id);
      idMap.set(m.id, m.id);
    } else {
      const { data: created } = await sb.from("modules").insert({
        course_id: course.id, owner_id: user.id, title, position: m.position, status: "locked"
      }).select("id").single();
      if (created) {
        keepModuleIds.add(created.id);
        if (m.id) idMap.set(m.id, created.id);
      }
    }
  }
  // Remove modules the student deleted (concepts cascade).
  for (const id of Array.from(existingIds)) {
    if (!keepModuleIds.has(id)) await sb.from("modules").delete().eq("id", id);
  }

  // Topics per module: match by id, insert new, delete removed.
  for (const m of edits) {
    const realId = (m.id && idMap.get(m.id)) || m.id;
    if (!realId || !keepModuleIds.has(realId)) continue;
    const { data: cur } = await sb.from("concepts").select("id").eq("module_id", realId);
    const curIds = new Set((cur ?? []).map((c) => c.id));
    const keep = new Set<string>();
    for (const t of (m.topics ?? []).slice(0, 40)) {
      if (!t.title?.trim()) continue;
      if (t.id && curIds.has(t.id)) {
        await sb.from("concepts").update({ title: t.title.trim().slice(0, 160) }).eq("id", t.id);
        keep.add(t.id);
      } else {
        const { data: cc } = await sb.from("concepts").insert({
          module_id: realId, course_id: course.id, owner_id: user.id, title: t.title.trim().slice(0, 160), status: "new"
        }).select("id").single();
        if (cc) keep.add(cc.id);
      }
    }
    for (const id of Array.from(curIds)) {
      if (!keep.has(id)) await sb.from("concepts").delete().eq("id", id);
    }
  }

  // Resource assignments: replace-all for modules in this course.
  if (body.assignments) {
    const modIds = Array.from(keepModuleIds);
    if (modIds.length > 0) {
      await sb.from("resource_module_assignments").delete().in("module_id", modIds);
      const rows = body.assignments
        .filter((a) => modIds.includes(a.module_id))
        .slice(0, 200)
        .map((a) => ({ resource_id: a.resource_id, module_id: a.module_id, owner_id: user.id, state: "confirmed" as const }));
      if (rows.length > 0) await sb.from("resource_module_assignments").insert(rows);
    }
  }

  if (body.confirm) {
    await sb.from("courses").update({ syllabus_status: "confirmed", status: "active" }).eq("id", course.id);
  }

  return NextResponse.json({ ok: true, confirmed: !!body.confirm });
}
