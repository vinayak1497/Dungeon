import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { chatFor, parseJsonResult } from "@/lib/ai/providers";
import { retrieve, contextBlock, moduleResourceIds } from "@/lib/ai/retrieval";

export const runtime = "nodejs";
export const maxDuration = 120;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Generates a revision sheet grounded in chunks + actual weak spots from
// recorded quiz answers. Weak topics only from real data — never invented.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string; concept?: string; moduleId?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  if (!body.courseId) return err("bad_request", "courseId required.");

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id,title").eq("id", body.courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  let moduleTitle: string | null = null;
  let scopeIds: string[] | undefined;
  if (body.moduleId) {
    const { data: mod } = await sb.from("modules").select("id,title,course_id").eq("id", body.moduleId).eq("owner_id", user.id).maybeSingle();
    if (!mod || mod.course_id !== course.id) return err("bad_request", "Module not in this course.", 400);
    moduleTitle = mod.title;
    scopeIds = await moduleResourceIds(mod.id, user.id);
  }

  const topic = body.concept ?? moduleTitle ?? course.title;
  const passages = await retrieve(user.id, body.courseId, topic, 10, scopeIds);
  if (passages.length === 0) return err("no_evidence", "Upload and process study material first.", 422);

  // Real weak spots: questions answered incorrectly in this course's quizzes.
  const { data: attempts } = await sb.from("quizzes").select("id").eq("course_id", course.id).eq("owner_id", user.id);
  const quizIds = ((attempts ?? []) as { id: string }[]).map((q) => q.id);
  let weak: string[] = [];
  if (quizIds.length > 0) {
    const { data: wrong } = await sb.from("quiz_answers").select("question_id,quiz_questions!inner(prompt,quiz_id)").eq("correct", false).limit(50);
    const rows = (wrong ?? []) as unknown as { quiz_questions: { prompt: string; quiz_id: string } | { prompt: string; quiz_id: string }[] }[];
    const prompts = rows
      .map((w) => Array.isArray(w.quiz_questions) ? w.quiz_questions[0] : w.quiz_questions)
      .filter((q) => q && quizIds.includes(q.quiz_id))
      .map((q) => q.prompt);
    weak = Array.from(new Set(prompts)).slice(0, 8);
  }

  try {
    const { text } = await chatFor("general", [
      {
        role: "system",
        content: "Write an exam revision sheet from the sources. Reply ONLY JSON: {\"title\":string,\"keyPoints\":[string],\"definitions\":[{\"term\":string,\"meaning\":string}],\"comparisons\":[string],\"practice\":[string]}. Concise, source-faithful."
      },
      { role: "user", content: `Sources:\n${contextBlock(passages).slice(0, 12000)}\n\nWeak spots from past quizzes:\n${weak.length ? weak.join("\n") : "(none recorded)"}` }
    ], 2000);
    const sheet = parseJsonResult<Record<string, unknown>>(text);
    const { data: saved, error: sErr } = await sb.from("revision_sheets").insert({
      course_id: course.id, owner_id: user.id, title: `${topic} — revision sheet`, content: { ...sheet, weak, sources: passages.map((p) => ({ filename: p.filename, page_no: p.page_no })) }
    }).select("id").single();
    if (sErr || !saved) return err("write_failed", sErr?.message ?? "Save failed.", 500);
    return NextResponse.json({ sheetId: saved.id, weak }, { status: 201 });
  } catch (e) {
    return err("ai_failed", e instanceof Error ? e.message : "Generation failed.", 502);
  }
}
