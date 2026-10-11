import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const FIELDS = [
  "display_name", "institution", "degree", "branch",
  "semester", "grad_year", "portal_url", "exam_date", "daily_goal_min"
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) {
    if (error.code === "42P01") return err("no_schema", "Database tables not created yet. Push supabase/migrations first.", 503);
    return err("read_failed", error.message, 500);
  }
  return NextResponse.json({ profile: data });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }

  const row: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() };
  for (const f of FIELDS) {
    if (body[f] !== undefined) row[f] = body[f] === "" ? null : body[f];
  }
  if (row.daily_goal_min !== undefined && row.daily_goal_min !== null && !Number.isFinite(Number(row.daily_goal_min))) {
    return err("bad_request", "daily_goal_min must be a number.");
  }

  const { data, error } = await supabase.from("profiles").upsert(row, { onConflict: "id" }).select().single();
  if (error) {
    if (error.code === "42P01") return err("no_schema", "Database tables not created yet. Push supabase/migrations first.", 503);
    return err("write_failed", error.message, 500);
  }
  return NextResponse.json({ profile: data });
}
