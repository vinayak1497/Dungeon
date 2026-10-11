import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Loads one owned canvas project with its first page + page list, so the
// /canvas/[canvasId] route can treat a UUID as a project id without
// creating duplicate pages on every visit.
export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const sb = createServiceClient();
  const { data: project } = await sb
    .from("canvas_projects")
    .select("id,course_id,title,updated_at")
    .eq("id", params.projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return err("not_found", "Canvas not found.", 404);

  const { data: siblings } = await sb
    .from("canvas_pages")
    .select("id,title,position")
    .eq("project_id", project.id)
    .order("position");

  let page = null;
  const firstId = (siblings?.[0] as { id?: string } | undefined)?.id;
  if (firstId) {
    const { data } = await sb
      .from("canvas_pages")
      .select("id,project_id,title,position,doc,updated_at")
      .eq("id", firstId)
      .eq("owner_id", user.id)
      .maybeSingle();
    page = data ?? null;
  }

  return NextResponse.json({ project, page, pages: siblings ?? [] });
}

// Renames the project (project-level, distinct from page title).
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { title }.");
  }
  const title = (body.title ?? "").trim();
  if (!title) return err("bad_request", "title required.");
  if (title.length > 160) return err("bad_request", "Title must be under 160 characters.");

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("canvas_projects")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", params.projectId)
    .eq("owner_id", user.id)
    .select("id,title")
    .maybeSingle();
  if (error) return err("write_failed", error.message, 500);
  if (!data) return err("not_found", "Canvas project not found.", 404);
  return NextResponse.json({ project: data });
}

// Deletes the project; pages cascade in the schema.
export async function DELETE(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const sb = createServiceClient();
  const { error } = await sb.from("canvas_projects").delete().eq("id", params.projectId).eq("owner_id", user.id);
  if (error) return err("write_failed", error.message, 500);
  return NextResponse.json({ ok: true });
}
