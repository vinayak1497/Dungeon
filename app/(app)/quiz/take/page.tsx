"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Timer, Check, ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, Progress, SourceChip } from "@/components/ui/meta";
import { Rise } from "@/components/motion";
import { cn } from "@/lib/utils";

type Question = { id: string; kind: string; prompt: string; options: string[]; position: number };
type QuizMeta = { id: string; course_id: string | null; title: string; scope: string; config: { difficulty?: string; concept?: string | null } | null };
type Feedback = { questionId: string; correct: boolean; graded: string; correctAnswer: unknown; explanation: string | null };

const kindLabel = (k: string) => (k === "mcq" ? "Multiple choice" : k === "tf" ? "True / False" : k === "short" ? "Short answer" : k);

function correctText(q: Question, fb: Feedback): string {
  if (q.kind === "mcq" && typeof fb.correctAnswer === "number") return q.options[fb.correctAnswer] ?? `Option ${fb.correctAnswer + 1}`;
  if (q.kind === "tf") return fb.correctAnswer === true ? "True" : fb.correctAnswer === false ? "False" : "—";
  if (q.kind === "short" && Array.isArray(fb.correctAnswer)) return (fb.correctAnswer as string[]).join("; ");
  return "—";
}

function answerText(q: Question, v: number | boolean | string | undefined): string {
  if (v === undefined) return "—";
  if (q.kind === "mcq" && typeof v === "number") return q.options[v] ?? `Option ${v + 1}`;
  if (q.kind === "tf" && typeof v === "boolean") return v ? "True" : "False";
  return String(v);
}

function TakeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const quizId = params.get("quizId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | boolean | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ attemptId: string; score: number; total: number; feedback: Feedback[] } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    if (!quizId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/quiz/${encodeURIComponent(quizId)}`);
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          setError(j?.error?.message ?? `Failed to load quiz (${res.status}).`);
          return;
        }
        setQuiz(j.quiz);
        setQuestions(j.questions ?? []);
      } catch {
        setError("Failed to load quiz.");
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId]);

  const answeredCount = useMemo(() => questions.filter((q) => {
    const v = answers[q.id];
    if (q.kind === "short") return typeof v === "string" && v.trim().length > 0;
    return v !== undefined;
  }).length, [questions, answers]);

  const fbById = useMemo(() => new Map((result?.feedback ?? []).map((f) => [f.questionId, f])), [result]);

  const submit = async () => {
    if (!quizId || submitting || result) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = questions.map((q) => ({ questionId: q.id, value: answers[q.id] }));
      const res = await fetch(`/api/quiz/${encodeURIComponent(quizId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(j?.error?.message ?? `Submit failed (${res.status}).`);
        return;
      }
      const r = { attemptId: j.attemptId, score: j.score, total: j.total, feedback: j.feedback };
      setResult(r);
      try {
        sessionStorage.setItem(`quiz-result-${j.attemptId}`, JSON.stringify({
          attemptId: j.attemptId, quizId, score: j.score, total: j.total,
          feedback: j.feedback, questions, answers, quiz, courseId: quiz?.course_id ?? null,
        }));
      } catch {
        // sessionStorage unavailable — results page will show its empty state
      }
    } catch {
      setSubmitError("Submit failed. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!quizId) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Card><CardContent className="space-y-3 p-6 text-center">
          <p className="text-[15px] font-semibold">No quiz selected</p>
          <p className="text-[13px] text-muted-foreground">Generate a quiz from a course first.</p>
          <Button size="sm" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Card><CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading quiz…</CardContent></Card>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Card><CardContent className="space-y-3 p-6 text-center">
          <p className="text-[15px] font-semibold">Couldn&apos;t load quiz</p>
          <p className="text-[13px] text-muted-foreground">{error ?? "Unknown error."}</p>
          <Button size="sm" variant="outline" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
        </CardContent></Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Card><CardContent className="space-y-3 p-6 text-center">
          <p className="text-[15px] font-semibold">No questions in this quiz</p>
          <p className="text-[13px] text-muted-foreground">The quiz was saved without questions. Generate a new one.</p>
          <Button size="sm" asChild><Link href="/quiz/setup">New quiz</Link></Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Rise>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11.5px] text-muted-foreground">{quiz.scope} · Quiz</p>
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{quiz.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent"><Timer className="size-3" /> Practice · untimed</Badge>
            {!confirmExit ? (
              <Button size="sm" variant="ghost" onClick={() => setConfirmExit(true)}><X /> Exit</Button>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[12px]">
                Leave? <Link href="/dashboard" className="font-semibold hover:underline">Yes</Link>
                <button onClick={() => setConfirmExit(false)} className="text-muted-foreground hover:text-foreground">No</button>
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={questions.length ? (answeredCount / questions.length) * 100 : 0} className="flex-1" />
          <span className="text-xs text-muted-foreground">{answeredCount} / {questions.length} answered</span>
        </div>
      </Rise>

      {result && (
        <Rise className="mt-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-[12px] text-muted-foreground">Score</p>
              <p className="text-4xl font-semibold tracking-tight">{result.score}%</p>
              <div className="mt-2 flex justify-center gap-2">
                <Badge tone="success"><Check className="size-3" /> {result.feedback.filter((f) => f.correct).length} correct</Badge>
                <Badge tone="warn"><X className="size-3" /> {result.feedback.filter((f) => !f.correct).length} missed</Badge>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => router.push(`/quiz/results?quizId=${encodeURIComponent(quizId)}&attemptId=${encodeURIComponent(result.attemptId)}`)}>
                  Full results <ArrowRight />
                </Button>
              </div>
              <p className="mx-auto mt-3 max-w-sm text-[12.5px] text-muted-foreground">
                {result.score >= 80
                  ? `Strong run — next try Hard to stretch, or drill the ${result.feedback.filter((f) => !f.correct).length} missed below.`
                  : result.score >= 55
                    ? "Solid base — review the missed explanations, then retry at Medium."
                    : "Tough set — review the missed explanations and retry at Easy before stepping up."}
              </p>
              {quiz?.course_id && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/quiz/setup?courseId=${encodeURIComponent(quiz.course_id)}&difficulty=${result.score >= 80 ? "hard" : result.score >= 55 ? "medium" : "easy"}`}>
                      Adaptive follow-up · {result.score >= 80 ? "Hard" : result.score >= 55 ? "Medium" : "Easy"} <ArrowRight />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </Rise>
      )}

      <div className="mt-4 space-y-3">
        <AnimatePresence mode="wait">
          {questions.map((q, i) => {
            const fb = fbById.get(q.id);
            const v = answers[q.id];
            const locked = !!result;
            return (
              <motion.div key={q.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <Card>
                  <CardContent className="space-y-2.5 p-5">
                    <div className="flex items-center gap-2">
                      <Badge>{kindLabel(q.kind)}</Badge>
                      <span className="text-[11.5px] text-muted-foreground">Q{i + 1}</span>
                    </div>
                    <p className="text-[15px] font-medium leading-snug">{q.prompt}</p>
                    {q.kind === "mcq" && (q.options ?? []).map((o, oi) => (
                      <button key={oi} disabled={locked} onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        className={cn("w-full rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition disabled:opacity-70",
                          v === oi ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                        <span className="mr-2 font-mono text-[11px] opacity-60">{String.fromCharCode(65 + oi)}</span>{o}
                      </button>
                    ))}
                    {q.kind === "tf" && (
                      <div className="flex gap-2">
                        {(["True", "False"] as const).map((label) => {
                          const val = label === "True";
                          return (
                            <button key={label} disabled={locked} onClick={() => setAnswers((a) => ({ ...a, [q.id]: val }))}
                              className={cn("flex-1 rounded-xl border py-2.5 text-[13.5px] font-medium transition disabled:opacity-70",
                                v === val ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>{label}</button>
                          );
                        })}
                      </div>
                    )}
                    {q.kind === "short" && (
                      <textarea value={typeof v === "string" ? v : ""} disabled={locked}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        placeholder="Type a 1–2 sentence answer…" className="min-h-[84px] w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-70" />
                    )}
                    {fb && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className={cn("rounded-xl border p-3.5", fb.correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5")}>
                        <p className={cn("flex items-center gap-1.5 text-[13.5px] font-semibold", fb.correct ? "text-emerald-700" : "text-amber-700")}>
                          {fb.correct ? <><Check className="size-4" /> Correct</> : <><Lightbulb className="size-4" /> Not quite — review below</>}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">Your answer: {answerText(q, answers[q.id])}</p>
                        {!fb.correct && <p className="mt-1 text-[13px] text-muted-foreground">Correct: {correctText(q, fb)}</p>}
                        {fb.explanation && <p className="mt-1 text-[13px] text-muted-foreground">Explanation: {fb.explanation}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <SourceChip label={quiz.scope} />
                          <Badge>{fb.graded === "auto-heuristic" ? "Auto-graded · heuristic" : "Auto-graded"}</Badge>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!result && (
        <div className="mt-4">
          {submitError && <p className="mb-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[13px] text-amber-700">{submitError}</p>}
          <Button className="w-full" disabled={answeredCount < questions.length || submitting} onClick={submit}>
            {submitting ? "Submitting…" : `Submit all · ${answeredCount}/${questions.length}`}
          </Button>
          {answeredCount < questions.length && (
            <p className="mt-2 text-center text-[12px] text-muted-foreground">Answer all questions to submit.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuizTakePage() {
  return (
    <Suspense>
      <TakeInner />
    </Suspense>
  );
}
