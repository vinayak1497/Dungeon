import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type Rec = { topic: string; reason: string; action: string };

/**
 * Personalized learning signal, computed ONLY from real data:
 * past quiz attempts/scores in this course + actually-missed questions.
 * Never invents topics. Empty history → neutral defaults.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId) return err("bad_request", "courseId required.");

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id,title").eq("id", courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  const { data: quizzes } = await sb.from("quizzes").select("id,config,created_at").eq("course_id", course.id).eq("owner_id", user.id).order("created_at", { ascending: false }).limit(20);
  const qrows = ((quizzes ?? []) as { id: string; config: { difficulty?: string } | null }[]);
  const quizIds = qrows.map((q) => q.id);

  let attempts: { id: string; quiz_id: string; score: number | null; created_at: string }[] = [];
  if (quizIds.length > 0) {
    const { data: att } = await sb.from("quiz_attempts").select("id,quiz_id,score,created_at").eq("owner_id", user.id).in("quiz_id", quizIds).order("created_at", { ascending: false }).limit(20);
    attempts = ((att ?? []) as typeof attempts);
  }
  const scores = attempts.map((a) => a.score).filter((s): s is number => typeof s === "number");
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const last = scores.length > 0 ? scores[0] : null;

  // Real weak spots: missed prompts in this course's quizzes.
  let weak: string[] = [];
  if (quizIds.length > 0) {
    const { data: wrong } = await sb.from("quiz_answers").select("question_id,quiz_questions!inner(prompt,quiz_id)").eq("correct", false).limit(50);
    const rows = (wrong ?? []) as unknown as { quiz_questions: { prompt: string; quiz_id: string } | { prompt: string; quiz_id: string }[] }[];
    const prompts = rows
      .map((w) => (Array.isArray(w.quiz_questions) ? w.quiz_questions[0] : w.quiz_questions))
      .filter((q) => q && quizIds.includes(q.quiz_id))
      .map((q) => q.prompt.trim())
      .filter(Boolean);
    weak = Array.from(new Set(prompts)).slice(0, 8);
  }

  // Adaptive difficulty: step up on strength, step down on struggle.
  const basis = last ?? avg;
  const recommendedDifficulty = basis == null ? "medium" : basis >= 80 ? "hard" : basis >= 55 ? "medium" : "easy";

  const recommendations: Rec[] = [];
  for (const w of weak.slice(0, 5)) {
    recommendations.push({
      topic: w.length > 90 ? `${w.slice(0, 90)}…` : w,
      reason: "Missed in a recent quiz",
      action: "revise"
    });
  }
  if (avg == null) {
    recommendations.push({ topic: "Take your first quiz", reason: "No attempts yet — baseline your knowledge", action: "quiz" });
  } else if (avg < 55) {
    recommendations.push({ topic: "Retry at Easy difficulty", reason: `Average ${avg}% — rebuild foundations first`, action: "quiz-easy" });
  } else if (avg >= 80 && weak.length === 0) {
    recommendations.push({ topic: "Stretch at Hard difficulty", reason: `Average ${avg}% — push into application questions`, action: "quiz-hard" });
  }
  if (weak.length > 0) {
    recommendations.push({ topic: "Generate flashcards for missed topics", reason: `${weak.length} weak spot${weak.length === 1 ? "" : "s"} recorded`, action: "flashcards" });
    recommendations.push({ topic: "Generate a revision sheet", reason: "Consolidate weak spots + key definitions", action: "revision" });
  }

  const weakLine = weak.length > 0 ? weak.slice(0, 3).join("; ") : "course fundamentals";
  const plan =
    basis == null
      ? [
        `Day 1 · Study material + Easy quiz (baseline)`,
        `Day 2 · Review misses + flashcards`,
        `Day 3 · Medium quiz + revision sheet`,
        `Day 4 · Light review of weak spots`
      ]
      : basis < 55
        ? [
          `Day 1 · Re-study sources + Easy quiz`,
          `Day 2 · Drill weak spots: ${weakLine}`,
          `Day 3 · Easy→Medium quiz + flashcards`,
          `Day 4 · Light review + revision sheet`
        ]
        : basis >= 80
          ? [
            `Day 1 · Hard quiz (stretch)`,
            `Day 2 · ${weak.length > 0 ? `Attack remaining gaps: ${weakLine}` : "Mixed review + flashcards"}`,
            `Day 3 · Mixed quiz + revision sheet`,
            `Day 4 · Light review, exam-ready pass`
          ]
          : [
            `Day 1 · Medium quiz`,
            `Day 2 · Weak topics + cards: ${weakLine}`,
            `Day 3 · Mixed quiz + revision sheet`,
            `Day 4 · Light review`
          ];

  return NextResponse.json({
    courseId: course.id,
    quizCount: quizIds.length,
    attemptCount: attempts.length,
    avgScore: avg,
    lastScore: last,
    weak,
    recommendedDifficulty,
    recommendations,
    plan,
    personalized: attempts.length > 0 || weak.length > 0
  });
}
