import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { downloadObject, extractBuffer, parseSyllabusStructure, type SyllabusNode } from "@/lib/ingest";
import { chatFor, aiStatus, parseJsonResult } from "@/lib/ai/providers";
import { extOf } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function aiRefine(text: string): Promise<SyllabusNode[] | null> {
  if (!aiStatus().available) return null;
  try {
    const { text: out } = await chatFor("classify", [
      {
        role: "system",
        content: "Extract course structure from syllabus text. Reply with ONLY JSON: {\"modules\":[{\"title\":string,\"topics\":[string]}]}. Preserve official names and order. Never invent modules not supported by the text; max 30 modules, max 20 topics each."
      },
      { role: "user", content: text.slice(0, 15000) }
    ], 2000);
    const parsed = parseJsonResult<{ modules: SyllabusNode[] }>(out);
    if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) return null;
    return parsed.modules.slice(0, 30).map((m) => ({
      title: String(m.title ?? "").slice(0, 160),
      topics: (Array.isArray(m.topics) ? m.topics : []).map((t) => String(t).slice(0, 160)).slice(0, 20)
    }));
  } catch {
    return null;
  }
}

// Analyzes the course syllabus into modules + concepts. Skips confirmed
// structures so student edits are never overwritten by reprocessing.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { courseId }.");
  }
  if (!body.courseId) return err("bad_request", "courseId required.");

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id,syllabus_status").eq("id", body.courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  if (course.syllabus_status === "confirmed") {
    const { data: mods } = await sb.from("modules").select("id,title,position").eq("course_id", course.id).order("position");
    return NextResponse.json({ courseId: course.id, status: "confirmed", modules: mods ?? [], untouched: true });
  }

  const { data: syl } = await sb.from("resources")
    .select("id,course_id,storage_path,filename")
    .eq("owner_id", user.id)
    .eq("scope", "syllabus")
    .order("created_at", { ascending: false })
    .limit(10);
  // Prefer the syllabus linked to this course, else the latest staged one.
  const linked = (syl ?? []).find((r) => (r as { course_id?: string | null }).course_id === course.id) ?? (syl ?? [])[0];
  if (!linked) return err("no_syllabus", "Upload a syllabus first.", 422);

  await sb.from("courses").update({ syllabus_status: "processing" }).eq("id", course.id);

  try {
    const buf = await downloadObject(linked.storage_path);
    const extracted = await extractBuffer(buf, extOf(linked.filename));
    if (extracted.empty) {
      await sb.from("courses").update({ syllabus_status: "none" }).eq("id", course.id);
      return err("empty_syllabus", extracted.note ?? "Syllabus has no extractable text.", 422);
    }

    let { modules, warnings } = parseSyllabusStructure(extracted.text);
    let refined = false;
    if (modules.length < 2) {
      const ai = await aiRefine(extracted.text);
      if (ai && ai.length > 0) {
        modules = ai;
        refined = true;
      } else {
        warnings = [...warnings, "Add modules manually or retry after editing the syllabus file."];
      }
    }

    // Replace unconfirmed structure (safe: confirmed courses return early).
    const { data: old } = await sb.from("modules").select("id").eq("course_id", course.id);
    if (old && old.length > 0) {
      await sb.from("modules").delete().eq("course_id", course.id);
    }
    const modRows = modules.map((m, i) => ({ course_id: course.id, owner_id: user.id, position: i, title: m.title, status: i === 0 ? "active" : "locked" }));
    const { data: created } = await sb.from("modules").insert(modRows).select("id,title,position");
    const conceptRows = (created ?? []).flatMap((cm, i) =>
      modules[i].topics.map((t) => ({ module_id: cm.id, course_id: course.id, owner_id: user.id, title: t, status: "new" }))
    );
    if (conceptRows.length > 0) await sb.from("concepts").insert(conceptRows);

    await sb.from("courses").update({ syllabus_status: "needs_review", syllabus_path: linked.storage_path }).eq("id", course.id);
    return NextResponse.json({
      courseId: course.id,
      status: "needs_review",
      modules: created ?? [],
      topicCount: conceptRows.length,
      refined,
      warnings
    });
  } catch (e) {
    await sb.from("courses").update({ syllabus_status: "none" }).eq("id", course.id);
    return err("analyze_failed", e instanceof Error ? e.message : "Analysis failed.", 500);
  }
}
