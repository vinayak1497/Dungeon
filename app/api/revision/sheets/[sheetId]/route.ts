import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Reads one owned revision sheet (ownership-scoped, same pattern as courses).
export async function GET(_req: NextRequest, { params }: { params: { sheetId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const sb = createServiceClient();
  const { data: sheet, error } = await sb
    .from("revision_sheets")
    .select("id,course_id,title,content,created_at")
    .eq("id", params.sheetId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return err("read_failed", error.message, 500);
  if (!sheet) return err("not_found", "Sheet not found.", 404);

  return NextResponse.json({ sheet });
}
