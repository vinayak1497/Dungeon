import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { downloadObject, extractBuffer, persistExtraction } from "@/lib/ingest";
import { autoAssignResource } from "@/lib/ai/autoAssign";
import { extOf } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Runs extraction + chunking for one owned resource. Idempotent.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { resourceId?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { resourceId }.");
  }
  if (!body.resourceId) return err("bad_request", "resourceId required.");

  const sb = createServiceClient();
  const { data: res, error: resErr } = await sb
    .from("resources")
    .select("id,course_id,scope,storage_path,filename")
    .eq("id", body.resourceId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (resErr || !res) return err("not_found", "Resource not found.", 404);

  const job = await sb.from("processing_jobs").insert({
    resource_id: res.id, owner_id: user.id, state: "processing"
  }).select("id").single();

  try {
    const buf = await downloadObject(res.storage_path);
    const extracted = await extractBuffer(buf, extOf(res.filename));
    await persistExtraction({
      resourceId: res.id,
      courseId: res.course_id,
      ownerId: user.id,
      extracted
    });
    if (job.data) {
      await sb.from("processing_jobs").update({
        state: extracted.empty ? "failed" : "completed",
        error: extracted.empty ? (extracted.note ?? "Empty extraction.") : null,
        updated_at: new Date().toISOString()
      }).eq("id", job.data.id);
    }
    // Automatic classification: file each ingested PDF into the syllabus or
    // its best-fit module right away (best-effort, never fails ingest).
    let autoAssign: unknown = null;
    if (!extracted.empty && res.course_id) {
      try {
        autoAssign = await autoAssignResource(user.id, res.course_id, res.id);
      } catch {
        autoAssign = null;
      }
    }
    return NextResponse.json({
      resourceId: res.id,
      status: extracted.empty ? "failed" : "ready",
      chars: extracted.text.length,
      pages: (extracted as { pages?: number | null }).pages ?? null,
      note: extracted.note ?? null,
      autoAssign
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Extraction failed.";
    // Never leak bundler/filesystem internals to the student.
    const friendly = /ENOENT|test\/data|MODULE_NOT_FOUND|Cannot find module/i.test(raw)
      ? "The PDF reader failed to start. Retry — if it persists, replace the file."
      : raw;
    if (job.data) {
      await sb.from("processing_jobs").update({
        state: "failed",
        error: friendly,
        updated_at: new Date().toISOString()
      }).eq("id", job.data.id);
    }
    await sb.from("resources").update({ status: "failed" }).eq("id", res.id);
    return err("extract_failed", friendly, 500);
  }
}
