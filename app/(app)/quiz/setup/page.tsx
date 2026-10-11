"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, SourceChip } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";
import { cn } from "@/lib/utils";

const types = [
  { id: "mcq", label: "MCQ" },
  { id: "tf", label: "True / False" },
  { id: "short", label: "Short answer" },
];
const diffs = ["Easy", "Medium", "Hard"];
const counts = [5, 10, 15, 20];

function SetupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const courseId = params.get("courseId") ?? "";
  const moduleId = params.get("moduleId") ?? "";
  const concept = params.get("concept") ?? "";

  const [type, setType] = useState<string[]>(["mcq", "tf", "short"]);
  const [diff, setDiff] = useState("Medium");
  const [count, setCount] = useState(10);
  const [rec, setRec] = useState<{ recommendedDifficulty: string; avgScore: number | null; weak: string[]; personalized: boolean } | null>(null);
  useEffect(() => {
    const d = params.get("difficulty")?.toLowerCase();
    if (d === "easy" || d === "medium" || d === "hard") setDiff(d[0].toUpperCase() + d.slice(1));
  }, [params]);
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        const res = await fetch(`/api/learning/recommendations?courseId=${encodeURIComponent(courseId)}`);
        const j = await res.json().catch(() => null);
        if (res.ok && j) setRec(j);
      } catch { /* recommendations are advisory — setup works without them */ }
    })();
  }, [courseId]);
  const toggleType = (id: string) =>
    setType((v) => (v.includes(id) ? (v.length === 1 ? v : v.filter((x) => x !== id)) : [...v, id]));
  const [timed, setTimed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const generate = async () => {
    if (!courseId || busy) return;
    setBusy(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId,
          moduleId: moduleId || undefined,
          concept: concept || undefined,
          count,
          difficulty: diff.toLowerCase(),
          types: type,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorCode(j?.error?.code ?? null);
        setError(j?.error?.message ?? `Generation failed (${res.status}).`);
        return;
      }
      router.push(`/quiz/take?quizId=${encodeURIComponent(j.quizId)}`);
    } catch {
      setError("Generation failed. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Topbar title="Quiz setup" crumbs={["Learn", "Quiz"]} actions={<Button size="sm" variant="ghost" asChild><Link href="/dashboard"><ArrowLeft /> Cancel</Link></Button>} />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 md:px-8">
        <Rise>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">New quiz</h2>
            <p className="text-[13px] text-muted-foreground">Scope · type · difficulty.</p>
          </div>
        </Rise>

        {!courseId ? (
          <Rise>
            <Card>
              <CardHeader><CardTitle>No course selected</CardTitle><CardDescription>Quizzes generate from a course&apos;s own study material.</CardDescription></CardHeader>
              <CardContent>
                <Button size="sm" asChild><Link href="/dashboard">Pick a course</Link></Button>
              </CardContent>
            </Card>
          </Rise>
        ) : (
          <Stagger className="space-y-3">
            <Item>
              <Card>
                <CardHeader><CardTitle>Scope</CardTitle><CardDescription>Derived from where you started this quiz.</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{moduleId ? "Module" : concept ? "Concept" : "Course"}</Badge>
                  {concept && <Badge>{concept}</Badge>}
                  <SourceChip label={courseId.slice(0, 8)} />
                </CardContent>
              </Card>
            </Item>
            <Item>
              <Card>
                <CardHeader><CardTitle>Question type</CardTitle><CardDescription>Pick one or more — only these are generated.</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {types.map((t) => (
                    <button key={t.id} onClick={() => toggleType(t.id)} className={cn("rounded-full border px-4 py-2 text-[13px] font-medium transition", type.includes(t.id) ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                      {t.label}
                    </button>
                  ))}
                </CardContent>
              </Card>
            </Item>
            <Item>
              <Card>
                <CardHeader><CardTitle>Difficulty</CardTitle><CardDescription>{rec?.personalized ? `Recommended: ${rec.recommendedDifficulty} (avg ${rec.avgScore ?? "—"}%, adapts to your history)` : "Adapts to your history after a few attempts."}</CardDescription></CardHeader>
                <CardContent className="flex gap-2">
                  {diffs.map((d) => (
                    <button key={d} onClick={() => setDiff(d)} className={cn("flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition", diff === d ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                      {d}
                    </button>
                  ))}
                </CardContent>
                {rec?.personalized && rec.recommendedDifficulty.toLowerCase() !== diff.toLowerCase() && (
                  <CardContent className="pt-0">
                    <button onClick={() => setDiff(rec.recommendedDifficulty[0].toUpperCase() + rec.recommendedDifficulty.slice(1))} className="text-[12.5px] font-medium text-muted-foreground underline hover:text-foreground">
                      Use recommended: {rec.recommendedDifficulty}
                    </button>
                  </CardContent>
                )}
                {rec?.weak && rec.weak.length > 0 && (
                  <CardContent className="flex flex-wrap gap-1.5 pt-0">
                    <span className="w-full text-[12px] text-muted-foreground">Will emphasize your misses:</span>
                    {rec.weak.slice(0, 3).map((w) => <Badge key={w}>{w.length > 60 ? `${w.slice(0, 60)}…` : w}</Badge>)}
                  </CardContent>
                )}
              </Card>
            </Item>
            <Item>
              <Card>
                <CardHeader><CardTitle>Questions</CardTitle></CardHeader>
                <CardContent className="flex gap-2">
                  {counts.map((c) => (
                    <button key={c} onClick={() => setCount(c)} className={cn("flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition", count === c ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                      {c}
                    </button>
                  ))}
                </CardContent>
              </Card>
            </Item>
            <Item>
              <Card>
                <CardContent className="flex items-center justify-between p-5">
                  <span className="flex items-center gap-2 text-sm font-medium"><Clock className="size-4" /> Timed display</span>
                  <button onClick={() => setTimed(!timed)} aria-label="Toggle timed" className={cn("h-6 w-11 rounded-full p-0.5 transition", timed ? "bg-foreground" : "bg-border")}>
                    <span className={cn("block size-5 rounded-full bg-background transition-all", timed ? "ml-5" : "ml-0")} />
                  </button>
                </CardContent>
              </Card>
            </Item>
          </Stagger>
        )}

        {courseId && (
          <Rise delay={0.1}>
            <p className="flex items-center gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
              <Layers className="size-3.5 shrink-0" /> Source: {concept ? `concept · ${concept}` : "whole course"} <SourceChip label={courseId.slice(0, 8)} />
            </p>
            {error && (
              <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 text-[13px]">
                <p className="font-semibold text-amber-700">
                  {errorCode === "no_evidence" ? "No study material yet" : errorCode === "ai_failed" ? "Generation failed" : "Couldn't generate quiz"}
                </p>
                <p className="mt-1 text-muted-foreground">{error}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {errorCode === "no_evidence" && (
                    <Button size="sm" variant="outline" asChild><Link href={`/courses/${courseId}`}>Upload material</Link></Button>
                  )}
                  <Button size="sm" variant="outline" onClick={generate} disabled={busy}>Retry</Button>
                </div>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={generate} disabled={busy}>
                {busy ? "Generating…" : <>Generate · {count} · {type.map((t) => types.find((x) => x.id === t)?.label).filter(Boolean).join(" + ")} <ArrowRight /></>}
              </Button>
              <Button variant="outline" asChild><Link href="/dashboard">Cancel</Link></Button>
            </div>
            <div className="mt-2 flex gap-2">
              <Badge>{concept || "Course"}</Badge><Badge>{diff}</Badge>{timed && <Badge tone="accent">Timed</Badge>}
            </div>
          </Rise>
        )}
      </div>
    </div>
  );
}

export default function QuizSetupPage() {
  return (
    <Suspense>
      <SetupInner />
    </Suspense>
  );
}
