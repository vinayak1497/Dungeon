import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persists page order. Accepts an ordered array of page ids; every id must
 * belong to this authorized project. Unknown/foreign/duplicate ids are rejected.
 */
export async function PUT(req: NextRequest, { params }: { params: { projectId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  if (!UUID_RE.test(params.projectId)) return err("bad_request", "Invalid project id.");

  let body: { order?: string[] };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { order: string[] }.");
  }
  const order = body.order;
  if (!Array.isArray(order) || order.length === 0 || order.length > 200) return err("bad_request", "order must be a non-empty array.");
  if (!order.every((id) => typeof id === "string" && UUID_RE.test(id))) return err("bad_request", "order contains an invalid page id.");
  if (new Set(order).size !== order.length) return err("bad_request", "order contains duplicate page ids.");

  const sb = createServiceClient();
  const { data: project } = await sb.from("canvas_projects").select("id").eq("id", params.projectId).eq("owner_id", user.id).maybeSingle();
  if (!project) return err("not_found", "Canvas project not found.", 404);

  const { data: owned } = await sb.from("canvas_pages").select("id").eq("project_id", project.id).eq("owner_id", user.id);
  const ownedIds = new Set(((owned ?? []) as { id: string }[]).map((p) => p.id));

  const unknown = order.filter((id) => !ownedIds.has(id));
  if (unknown.length > 0) return err("forbidden", "Some page ids do not belong to this project.", 403);

  // Preserve pages the client did not mention: append them after the given order.
  const remainder = Array.from(ownedIds).filter((id) => !order.includes(id));
  const finalOrder = [...order, ...remainder];

  // Two-phase write avoids a unique/ordering clash mid-update.
  await sb.from("canvas_pages").update({ position: -1 }).eq("project_id", project.id);
  for (let i = 0; i < finalOrder.length; i++) {
    await sb.from("canvas_pages").update({ position: i }).eq("id", finalOrder[i]).eq("owner_id", user.id);
  }

  const { data: pages } = await sb.from("canvas_pages").select("id,title,position").eq("project_id", project.id).order("position");
  return NextResponse.json({ pages: pages ?? [] });
}