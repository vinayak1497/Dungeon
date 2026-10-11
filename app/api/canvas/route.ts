import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function validDoc(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as { version?: unknown; elements?: unknown };
  if (d.version !== 1) return false;
  if (!Array.isArray(d.elements) || d.elements.length > 500) return false;
  return d.elements.every((el) => el && typeof el === "object" && typeof (el as { id?: unknown }).id === "string" && typeof (el as { text?: unknown }).text === "string");
}

// Lists the student's canvas projects for a course (with pages).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const courseId = new URL(req.url).searchParams.get("courseId");
  const sb = createServiceClient();
  let q = sb.from("canvas_projects").select("id,title,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(20);
  if (courseId) q = q.eq("course_id", courseId);
  const { data: projects } = await q;
  return NextResponse.json({ projects: projects ?? [] });
}

// Creates a project (+first page) or appends a page / renames.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string | null; title?: string; projectId?: string; pageTitle?: string; doc?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }

  const sb = createServiceClient();
  if (body.projectId) {
    const { data: proj } = await sb.from("canvas_projects").select("id").eq("id", body.projectId).eq("owner_id", user.id).maybeSingle();
    if (!proj) return err("not_found", "Canvas not found.", 404);
    const { data: pages } = await sb.from("canvas_pages").select("position").eq("project_id", proj.id).order("position", { ascending: false }).limit(1);
    const pos = ((pages?.[0] as { position?: number } | undefined)?.position ?? -1) + 1;
    const { data: page, error } = await sb.from("canvas_pages").insert({
      project_id: proj.id, owner_id: user.id, position: pos, title: (body.pageTitle ?? `Page ${pos + 1}`).slice(0, 120), doc: { version: 1, elements: [] }
    }).select("id,title,position").single();
    if (error) return err("write_failed", error.message, 500);
    return NextResponse.json({ page }, { status: 201 });
  }

  const { data: proj, error } = await sb.from("canvas_projects").insert({
    course_id: body.courseId ?? null, owner_id: user.id, title: (body.title ?? "Untitled canvas").slice(0, 160)
  }).select("id,title").single();
  if (error || !proj) return err("write_failed", error?.message ?? "Save failed.", 500);
  const { data: page } = await sb.from("canvas_pages").insert({
    project_id: proj.id, owner_id: user.id, position: 0, title: "Page 1", doc: { version: 1, elements: body.doc && validDoc(body.doc) ? body.doc : { version: 1, elements: [] } }
  }).select("id,title,position,doc").single();
  return NextResponse.json({ project: proj, page }, { status: 201 });
}
