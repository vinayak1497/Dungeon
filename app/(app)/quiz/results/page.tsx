"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RotateCcw, Plus, ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";

type StoredQuestion = { id: string; kind: string; prompt: string; options: string[] };
type StoredFeedback = { questionId: string; correct: boolean; graded: string; correctAnswer: unknown; explanation: string | null };
type StoredResult = {
  attemptId: string; quizId: string; score: number; total: number;
  feedback: StoredFeedback[]; questions: StoredQuestion[];
  answers: Record<string, number | boolean | string>;
  quiz: { id: string; title: string; scope: string } | null;
  courseId?: string | null;
};

function correctText(q: StoredQuestion, fb: StoredFeedback): string {
  if (q.kind === "mcq" && typeof fb.correctAnswer === "number") return q.options[fb.correctAnswer] ?? `Option ${fb.correctAnswer + 1}`;
  if (q.kind === "tf") return fb.correctAnswer === true ? "True" : fb.correctAnswer === false ? "False" : "—";
  if (q.kind === "short" && Array.isArray(fb.correctAnswer)) return (fb.correctAnswer as string[]).join("; ");
  return "—";
}

function ResultsInner() {
  const params = useSearchParams();
  const quizId = params.get("quizId") ?? "";
  const attemptId = params.get("attemptId") ?? "";
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [data, setData] = useState<StoredResult | null>(null);

  useEffect(() => {
    if (!attemptId) {
      setStatus("missing");
      return;
    }
    try {
      const raw = sessionStorage.getItem(`quiz-result-${attemptId}`);
      if (!raw) {
        setStatus("missing");
        return;
      }
      setData(JSON.parse(raw) as StoredResult);
      setStatus("ready");
    } catch {
      setStatus("missing");
    }
  }, [attemptId]);

  if (status === "loading") {
    return (
      <div>
        <Topbar title="Results" crumbs={["Learn", "Quiz", "Results"]} />
        <div className="mx-auto max-w-2xl px-5 py-6 md:px-8">
          <Card><CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading results…</CardContent></Card>
        </div>
      </div>
    );
  }

  if (status === "missing" || !data) {
    return (
      <div>
        <Topbar title="Results" crumbs={["Learn", "Quiz", "Results"]} />
        <div className="mx-auto max-w-2xl px-5 py-6 md:px-8">
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <p className="text-[15px] font-semibold">Open from a completed quiz</p>
              <p className="text-[13px] text-muted-foreground">Results live on the device where the quiz was submitted. Submit a quiz first, then follow its results link.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {quizId && <Button size="sm" asChild><Link href={`/quiz/take?quizId=${encodeURIComponent(quizId)}`}><RotateCcw /> Open quiz</Link></Button>}
                <Button size="sm" variant="outline" asChild><Link href="/dashboard"><ArrowLeft /> Return</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const correct = data.feedback.filter((f) => f.correct).length;
  const missed = data.feedback.length - correct;
  const qById = new Map(data.questions.map((q) => [q.id, q]));

  return (
    <div>
      <Topbar title="Results" crumbs={["Learn", "Quiz", "Results"]} />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 md:px-8">
        <Rise>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-[12px] text-muted-foreground">{data.quiz?.title ?? "Score"}</p>
              <p className="text-4xl font-semibold tracking-tight">{data.score}%</p>
              <Progress value={data.score} className="mx-auto mt-3 max-w-xs" />
              <div className="mt-3 flex justify-center gap-2">
                <Badge tone="success"><Check className="size-3" /> {correct} correct</Badge>
                <Badge tone="warn"><X className="size-3" /> {missed} missed</Badge>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button size="sm" asChild><Link href={`/quiz/take?quizId=${encodeURIComponent(data.quizId)}`}><RotateCcw /> Retry</Link></Button>
                <Button size="sm" variant="outline" asChild><Link href="/quiz/setup"><Plus /> New quiz</Link></Button>
                <Button size="sm" variant="ghost" asChild><Link href="/dashboard"><ArrowLeft /> Return</Link></Button>
              </div>
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-border bg-muted p-3 text-left">
                <p className="text-[13px] font-semibold">
                  {data.score >= 80 ? "Adaptive: step up to Hard" : data.score >= 55 ? "Adaptive: consolidate at Medium" : "Adaptive: rebuild at Easy"}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {data.score >= 80
                    ? "Strong score — future quizzes should stretch you with application questions."
                    : data.score >= 55
                      ? "Review the missed explanations above, then retry — misses feed your next quiz."
                      : "Review misses + flashcards first, then retry easier before stepping up."}
                </p>
                {data.courseId && (
                  <Button size="sm" className="mt-2" asChild>
                    <Link href={`/quiz/setup?courseId=${encodeURIComponent(data.courseId)}&difficulty=${data.score >= 80 ? "hard" : data.score >= 55 ? "medium" : "easy"}`}>
                      <Plus /> Adaptive follow-up · {data.score >= 80 ? "Hard" : data.score >= 55 ? "Medium" : "Easy"}
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </Rise>
        <Stagger className="space-y-3">
          <Item>
            <Card>
              <CardHeader><CardTitle>Review</CardTitle><CardDescription>{data.feedback.length} questions · short answers auto-graded by keyword heuristic</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {data.feedback.map((f, i) => {
                  const q = qById.get(f.questionId);
                  return (
                    <div key={f.questionId} className="rounded-xl border border-border px-3 py-2.5 text-[13px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">Q{i + 1} · {q?.prompt ?? f.questionId}</span>
                        <Badge tone={f.correct ? "success" : "warn"}>{f.correct ? "Correct" : "Missed"}</Badge>
                      </div>
                      {q && <p className="mt-1 text-muted-foreground">{q.prompt}</p>}
                      {!f.correct && q && <p className="mt-1 text-muted-foreground">Correct: {correctText(q, f)}</p>}
                      {f.explanation && <p className="mt-1 text-muted-foreground">Why: {f.explanation}</p>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </Item>
          <Item>
            <Card>
              <CardHeader><CardTitle>Missed questions</CardTitle><CardDescription>{missed === 0 ? "Clean run — nothing to drill." : "From your answers"}</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {missed === 0 ? (
                  <Badge tone="success">No misses</Badge>
                ) : (
                  <>
                    <Badge tone="warn">{missed} to review</Badge>
                    <Button size="sm" variant="outline" asChild><Link href="/flashcards">Drill cards</Link></Button>
                  </>
                )}
              </CardContent>
            </Card>
          </Item>
        </Stagger>
      </div>
    </div>
  );
}

export default function QuizResultsPage() {
  return (
    <Suspense>
      <ResultsInner />
    </Suspense>
  );
}
