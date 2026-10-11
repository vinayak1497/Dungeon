import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { isValidDoc } from "@/lib/canvas/doc";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Loads one page (ownership-checked) or saves title/doc.
export async function GET(_req: NextRequest, { params }: { params: { pageId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const sb = createServiceClient();
  const { data: page } = await sb.from("canvas_pages").select("id,project_id,title,position,doc,updated_at").eq("id", params.pageId).eq("owner_id", user.id).maybeSingle();
  if (!page) return err("not_found", "Page not found.", 404);
  const { data: siblings } = await sb.from("canvas_pages").select("id,title,position").eq("project_id", page.project_id).order("position");
  return NextResponse.json({ page, pages: siblings ?? [] });
}

export async function PUT(req: NextRequest, { params }: { params: { pageId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { title?: string; doc?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  if (body.doc !== undefined && !isValidDoc(body.doc)) return err("bad_request", "Invalid canvas document.");

  const sb = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 120);
  if (body.doc !== undefined) patch.doc = body.doc;
  const { error } = await sb.from("canvas_pages").update(patch).eq("id", params.pageId).eq("owner_id", user.id);
  if (error) return err("write_failed", error.message, 500);
  const { data: owner } = await sb.from("canvas_pages").select("project_id").eq("id", params.pageId).maybeSingle();
  if (owner) {
    await sb.from("canvas_projects").update({ updated_at: new Date().toISOString() }).eq("id", (owner as { project_id: string }).project_id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { pageId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const sb = createServiceClient();
  const { error } = await sb.from("canvas_pages").delete().eq("id", params.pageId).eq("owner_id", user.id);
  if (error) return err("write_failed", error.message, 500);
  return NextResponse.json({ ok: true });
}
