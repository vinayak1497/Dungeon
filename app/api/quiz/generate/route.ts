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

type GenQ = {
  kind: "mcq" | "tf" | "short";
  prompt: string;
  options?: string[];
  answerIndex?: number;
  answerBool?: boolean;
  keyPoints?: string[];
  explanation?: string;
  concept?: string;
};

function validQuestions(qs: unknown): GenQ[] | null {
  if (!Array.isArray(qs) || qs.length === 0 || qs.length > 20) return null;
  const out: GenQ[] = [];
  for (const q of qs as GenQ[]) {
    if (!q || typeof q.prompt !== "string" || !q.prompt.trim()) return null;
    if (q.kind === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 5) return null;
      if (typeof q.answerIndex !== "number" || q.answerIndex < 0 || q.answerIndex >= q.options.length) return null;
    } else if (q.kind === "tf") {
      if (typeof q.answerBool !== "boolean") return null;
    } else if (q.kind === "short") {
      if (!Array.isArray(q.keyPoints) || q.keyPoints.length === 0) return null;
    } else {
      return null;
    }
    out.push({
      kind: q.kind,
      prompt: q.prompt.slice(0, 600),
      options: q.options?.map((o) => String(o).slice(0, 300)),
      answerIndex: q.answerIndex,
      answerBool: q.answerBool,
      keyPoints: q.keyPoints?.map((k) => String(k).slice(0, 200)),
      explanation: typeof q.explanation === "string" ? q.explanation.slice(0, 600) : undefined,
      concept: typeof q.concept === "string" ? q.concept.slice(0, 120) : undefined
    });
  }
  return out;
}

// Generates a grounded quiz from the student's own chunks. No chunks → 422.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string; concept?: string; moduleId?: string; count?: number; difficulty?: string; types?: string[] };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  if (!body.courseId) return err("bad_request", "courseId required.");
  const count = Math.min(15, Math.max(3, body.count ?? 8));

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id,title").eq("id", body.courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  // Module scoping: restrict retrieval to the module's assigned PDFs.
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
  if (passages.length === 0) return err("no_evidence", "Upload and process study material first — quizzes generate from your sources.", 422);

  // Personalization: emphasize concepts answered incorrectly before.
  let weakNote = "";
  try {
    const { data: quizzes } = await sb.from("quizzes").select("id").eq("course_id", course.id).eq("owner_id", user.id).limit(20);
    const qids = ((quizzes ?? []) as { id: string }[]).map((q) => q.id);
    if (qids.length > 0) {
      const { data: wrong } = await sb.from("quiz_answers").select("question_id,quiz_questions!inner(prompt,quiz_id)").eq("correct", false).limit(30);
      const rows = (wrong ?? []) as unknown as { quiz_questions: { prompt: string; quiz_id: string } | { prompt: string; quiz_id: string }[] }[];
      const prompts = rows
        .map((w) => (Array.isArray(w.quiz_questions) ? w.quiz_questions[0] : w.quiz_questions))
        .filter((q) => q && qids.includes(q.quiz_id))
        .map((q) => q.prompt);
      const uniq = Array.from(new Set(prompts)).slice(0, 5);
      if (uniq.length > 0) weakNote = `\nThe student previously missed these — emphasize related ideas:\n${uniq.join("\n")}`;
    }
  } catch {
    weakNote = "";
  }

  // Requested question types (validated) constrain what the model may return.
  const requested = (Array.isArray(body.types) ? body.types : [])
    .filter((t): t is "mcq" | "tf" | "short" => t === "mcq" || t === "tf" || t === "short");
  const allowedTypes = requested.length > 0 ? Array.from(new Set(requested)) : ["mcq", "tf", "short"];

  const typeRule =
    allowedTypes.length === 3
      ? "Use a mix of mcq, tf and short."
      : `ONLY generate these kinds: ${allowedTypes.join(", ")}. Do not use any other kind.`;

  const difficulty = (body.difficulty ?? "medium").toLowerCase();
  const difficultyRule: Record<string, string> = {
    easy: "Difficulty EASY: recall-level only. Ask 'what is / define / list'. Use the exact wording of the source.",
    medium: "Difficulty MEDIUM: understanding-level. Ask for explanation, comparison or 'why'. Require reasoning from the source.",
    hard: "Difficulty HARD: application/analysis. Ask 'if X then why', edge cases, or multi-step reasoning combining two ideas from the source."
  };

  let questions: GenQ[] | null = null;
  try {
    const { text } = await chatFor("quiz", [
      {
        role: "system",
        content: `Write ${count} quiz questions from these sources. ${difficultyRule[difficulty] ?? difficultyRule.medium} ${typeRule} Reply ONLY JSON: {"questions":[{"kind":"mcq"|"tf"|"short","prompt":string,"options":[4 strings, mcq only],"answerIndex":number,"answerBool":boolean,"keyPoints":[strings, short only],"explanation":string,"concept":string}]}. Base every question on the sources.`
      },
      { role: "user", content: (contextBlock(passages).slice(0, 12000) + weakNote).slice(0, 13000) }
    ], 2500);
    questions = validQuestions(parseJsonResult<{ questions: GenQ[] }>(text).questions);
  } catch (e) {
    return err("ai_failed", e instanceof Error ? e.message : "Generation failed.", 502);
  }
  // Enforce the requested types server-side (models do not always obey).
  if (requested.length > 0 && questions) {
    const filtered = questions.filter((q) => allowedTypes.includes(q.kind));
    if (filtered.length > 0) questions = filtered;
  }
  if (!questions) return err("invalid_output", "Model output failed validation. Retry.", 502);
  const finalQuestions = questions;

  const { data: quiz, error: qErr } = await sb.from("quizzes").insert({
    course_id: course.id,
    owner_id: user.id,
    title: `${topic} — practice`,
    scope: body.moduleId ? "module" : body.concept ? "concept" : "course",
    config: { difficulty, types: allowedTypes, concept: body.concept ?? null, moduleId: body.moduleId ?? null }
  }).select("id").single();
  if (qErr || !quiz) return err("write_failed", qErr?.message ?? "Save failed.", 500);

  const rows = finalQuestions.map((q, i) => ({
    quiz_id: quiz.id,
    kind: q.kind,
    prompt: q.prompt,
    options: q.options ?? [],
    answer: q.kind === "mcq" ? { index: q.answerIndex } : q.kind === "tf" ? { bool: q.answerBool } : { keyPoints: q.keyPoints },
    explanation: q.explanation ?? null,
    position: i
  }));
  const { error: qqErr } = await sb.from("quiz_questions").insert(rows);
  if (qqErr) return err("write_failed", qqErr.message, 500);

  return NextResponse.json({ quizId: quiz.id, count: finalQuestions.length, types: allowedTypes }, { status: 201 });
}
