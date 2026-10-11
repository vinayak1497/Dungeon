import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const { data, error } = await supabase
    .from("courses")
    .select("id,title,code,semester,dept,exam_date,description,status,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return err("no_schema", "Database tables not created yet. Push supabase/migrations first.", 503);
    return err("read_failed", error.message, 500);
  }

  // Attach lightweight counts (best-effort; missing tables degrade to zero).
  const ids = (data ?? []).map((c) => c.id);
  let counts: Record<string, { modules: number; resources: number }> = {};
  if (ids.length > 0) {
    const [mods, res] = await Promise.all([
      supabase.from("modules").select("course_id").in("course_id", ids),
      supabase.from("resources").select("course_id").in("course_id", ids)
    ]);
    for (const c of ids) counts[c] = { modules: 0, resources: 0 };
    for (const m of (mods.data ?? []) as { course_id: string }[]) {
      if (counts[m.course_id]) counts[m.course_id].modules += 1;
    }
    for (const r of (res.data ?? []) as { course_id: string }[]) {
      if (r.course_id && counts[r.course_id]) counts[r.course_id].resources += 1;
    }
  }

  return NextResponse.json({
    courses: (data ?? []).map((c) => ({ ...c, ...counts[c.id] }))
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return err("bad_request", "Course title is required.");
  if (title.length > 120) return err("bad_request", "Title must be under 120 characters.");

  // Syllabus is compulsory: every course is structured from its syllabus.
  const syllabusPath = typeof body.syllabusPath === "string" ? body.syllabusPath : null;
  if (!syllabusPath || syllabusPath.includes("..")) {
    return err("no_syllabus", "Syllabus is required. Upload it in step 1 before creating the course.", 422);
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  const row = {
    owner_id: user.id,
    title: title.slice(0, 120),
    code: str(body.code),
    semester: str(body.semester),
    dept: str(body.dept),
    exam_date: str(body.exam_date),
    description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
    status: "draft" as const
  };

  const { data, error } = await supabase.from("courses").insert(row).select().single();
  if (error) {
    if (error.code === "42P01") return err("no_schema", "Database tables not created yet. Push supabase/migrations first.", 503);
    return err("write_failed", error.message, 500);
  }

  // Attach the staged syllabus (validated above) to the new course.
  {
    try {
      const { createServiceClient, RESOURCES_BUCKET } = await import("@/utils/supabase/service");
      const sb = createServiceClient();
      const allowed = syllabusPath.startsWith(`${user.id}/`) || syllabusPath.startsWith("anonymous/");
      if (allowed) {
        const file = syllabusPath.split("/").pop()!;
        const dest = `${user.id}/${data.id}/syllabus/${file}`;
        const { error: mvErr } = await sb.storage.from(RESOURCES_BUCKET).move(syllabusPath, dest);
        if (!mvErr) {
          await sb.from("resources").update({ storage_path: dest, course_id: data.id }).eq("storage_path", syllabusPath).eq("owner_id", user.id);
          await sb.from("courses").update({ syllabus_path: dest }).eq("id", data.id);
        }
      }
    } catch {
      // course creation still succeeds; syllabus stays staged
    }
  }

  return NextResponse.json({ course: data }, { status: 201 });
}
