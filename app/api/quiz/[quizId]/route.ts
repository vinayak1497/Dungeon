import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type Q = {
  id: string; kind: string; prompt: string; options: string[];
  answer: { index?: number; bool?: boolean; keyPoints?: string[] } | null;
  explanation: string | null; position: number;
};

async function ownedQuiz(quizId: string, userId: string) {
  const sb = createServiceClient();
  const { data } = await sb.from("quizzes").select("id,course_id,title,scope,config").eq("id", quizId).eq("owner_id", userId).maybeSingle();
  return data;
}

// Questions WITHOUT answers (safe to send before submission).
export async function GET(_req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const quiz = await ownedQuiz(params.quizId, user.id);
  if (!quiz) return err("not_found", "Quiz not found.", 404);

  const sb = createServiceClient();
  const { data } = await sb.from("quiz_questions").select("id,kind,prompt,options,position").eq("quiz_id", quiz.id).order("position");
  return NextResponse.json({ quiz, questions: data ?? [] });
}

// Server-side grading. Short answers: keyword-overlap heuristic, labeled.
export async function POST(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const quiz = await ownedQuiz(params.quizId, user.id);
  if (!quiz) return err("not_found", "Quiz not found.", 404);

  let body: { answers?: { questionId: string; value: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { answers }.");
  }
  const given = new Map((body.answers ?? []).map((a) => [a.questionId, a.value]));

  const sb = createServiceClient();
  const { data: qs } = await sb.from("quiz_questions").select("id,kind,prompt,options,answer,explanation,position").eq("quiz_id", quiz.id).order("position");
  if (!qs || qs.length === 0) return err("not_found", "No questions.", 404);

  const feedback = (qs as Q[]).map((q) => {
    const v = given.get(q.id);
    let correct = false;
    if (q.kind === "mcq" && typeof v === "number") correct = v === q.answer?.index;
    else if (q.kind === "tf" && typeof v === "boolean") correct = v === q.answer?.bool;
    else if (q.kind === "short" && typeof v === "string") {
      const keys = q.answer?.keyPoints ?? [];
      const low = v.toLowerCase();
      const hits = keys.filter((k) => low.includes(k.toLowerCase().split(" ").slice(0, 3).join(" ") ) || k.toLowerCase().split(" ").some((w) => w.length > 4 && low.includes(w)));
      correct = keys.length > 0 && hits.length >= Math.max(1, Math.ceil(keys.length / 2));
    }
    return {
      questionId: q.id,
      correct,
      graded: q.kind === "short" ? "auto-heuristic" : "exact",
      correctAnswer: q.kind === "mcq" ? q.answer?.index : q.kind === "tf" ? q.answer?.bool : q.answer?.keyPoints,
      explanation: q.explanation
    };
  });
  const score = Math.round((feedback.filter((f) => f.correct).length / feedback.length) * 100);

  const { data: attempt, error: aErr } = await sb.from("quiz_attempts").insert({ quiz_id: quiz.id, owner_id: user.id, score }).select("id").single();
  if (aErr || !attempt) return err("write_failed", aErr?.message ?? "Save failed.", 500);
  await sb.from("quiz_answers").insert(
    (qs as Q[]).map((q) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      value: { v: given.get(q.id) ?? null },
      correct: feedback.find((f) => f.questionId === q.id)?.correct ?? false
    }))
  );

  return NextResponse.json({ attemptId: attempt.id, score, total: feedback.length, feedback });
}
