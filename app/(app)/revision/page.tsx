"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";
import { cn } from "@/lib/utils";

type LastSheet = { sheetId: string; weak: string[]; courseId: string; createdAt: string };
type Recs = {
  avgScore: number | null; lastScore: number | null; weak: string[];
  recommendedDifficulty: string; personalized: boolean;
  recommendations: { topic: string; reason: string; action: string }[];
  plan: string[];
};

function RevisionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const courseId = params.get("courseId") ?? "";
  const moduleId = params.get("moduleId") ?? "";
  const concept = params.get("concept") ?? "";

  const [plan, setPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [last, setLast] = useState<LastSheet | null>(null);
  const [recs, setRecs] = useState<Recs | null>(null);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        const res = await fetch(`/api/learning/recommendations?courseId=${encodeURIComponent(courseId)}`);
        const j = await res.json().catch(() => null);
        if (res.ok && j) setRecs(j);
      } catch { /* plan falls back to generic template */ }
    })();
  }, [courseId]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("revision-sheet-last");
      if (raw) {
        const parsed = JSON.parse(raw) as LastSheet;
        if (!courseId || parsed.courseId === courseId) setLast(parsed);
        else setLast(parsed);
      }
    } catch {
      // no stored sheet — honest empty state below
    }
  }, [courseId]);

  const generate = async () => {
    if (!courseId || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/revision/sheets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, moduleId: moduleId || undefined, concept: concept || undefined }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setGenError(j?.error?.message ?? `Generation failed (${res.status}).`);
        return;
      }
      const entry: LastSheet = { sheetId: j.sheetId, weak: j.weak ?? [], courseId, createdAt: new Date().toISOString() };
      try {
        sessionStorage.setItem("revision-sheet-last", JSON.stringify(entry));
      } catch {
        // storage unavailable — navigation still works
      }
      setLast(entry);
      router.push(`/revision/sheet?sheetId=${encodeURIComponent(j.sheetId)}`);
    } catch {
      setGenError("Generation failed. Check your connection and retry.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Topbar
        title="Revision center"
        crumbs={["Learn", "Revision"]}
        actions={
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPlan(!plan)}><LayoutGrid /> {plan ? "Cards" : "Plan"}</Button>
            <Button size="sm" onClick={generate} disabled={!courseId || generating}><FileText /> {generating ? "Generating…" : "Generate sheet"}</Button>
          </span>
        }
      />
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-6 md:px-8">
        {!courseId ? (
          <Rise>
            <Card>
              <CardHeader><CardTitle>No course selected</CardTitle><CardDescription>Revision sheets generate from a course&apos;s own material.</CardDescription></CardHeader>
              <CardContent>
                <Button size="sm" asChild><Link href="/dashboard">Pick a course</Link></Button>
              </CardContent>
            </Card>
          </Rise>
        ) : (
          <Rise>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Next step: generate a revision sheet{concept ? ` for ${concept}` : ""}</p>
                  <p className="text-[12.5px] text-muted-foreground">Grounded in your uploads + real quiz misses</p>
                </div>
                <Button size="sm" onClick={generate} disabled={generating}>{generating ? "Generating…" : "Generate"} <ArrowRight /></Button>
              </CardContent>
            </Card>
          </Rise>
        )}
        {genError && <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[13px] text-amber-700">{genError}</p>}
        {!plan ? (
          <Stagger className="grid gap-3 md:grid-cols-2">
            <Item>
              <Card>
                <CardHeader><CardTitle>Weak topics</CardTitle><CardDescription>From your last generated sheet — real quiz misses only</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {!last ? (
                    <span className="text-[13px] text-muted-foreground">No sheet generated yet this session.</span>
                  ) : last.weak.length === 0 ? (
                    <span className="text-[13px] text-muted-foreground">No weak spots recorded yet — they appear after graded quizzes.</span>
                  ) : (
                    last.weak.map((w) => <Badge key={w} tone="warn">{w}</Badge>)
                  )}
                </CardContent>
              </Card>
            </Item>
            <Item>
              <Card>
                <CardHeader><CardTitle>Last sheet</CardTitle><CardDescription>This session only — no sheet history is stored server-side</CardDescription></CardHeader>
                <CardContent>
                  {!last ? (
                    <span className="text-[13px] text-muted-foreground">Generate your first sheet to see it here.</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{new Date(last.createdAt).toLocaleString()}</Badge>
                      <Button size="sm" asChild><Link href={`/revision/sheet?sheetId=${encodeURIComponent(last.sheetId)}`}>Open sheet</Link></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Item>
            <Item>
              <Card>
                <CardHeader><CardTitle>Practice</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  <Link href={courseId ? `/quiz/setup?courseId=${encodeURIComponent(courseId)}` : "/dashboard"} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-[13px] hover:bg-muted">
                    New quiz<ArrowRight className="size-3.5" />
                  </Link>
                  <Link href={courseId ? `/flashcards?courseId=${encodeURIComponent(courseId)}` : "/flashcards"} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-[13px] hover:bg-muted">
                    Review cards<ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            </Item>
            <Item>
              <Card>
                <CardHeader><CardTitle>Course progress</CardTitle><CardDescription>Lives on the course page</CardDescription></CardHeader>
                <CardContent>
                  {courseId ? (
                    <Button size="sm" variant="outline" asChild><Link href={`/courses/${courseId}`}>Open course</Link></Button>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Pick a course to continue.</span>
                  )}
                </CardContent>
              </Card>
            </Item>
          </Stagger>
        ) : (
          <>
          <Card>
            <CardHeader><CardTitle>4-day plan</CardTitle><CardDescription>{recs?.personalized ? `Personalized · avg ${recs.avgScore ?? "—"}% · next quiz: ${recs.recommendedDifficulty}` : "Answer a quiz to personalize this plan"}</CardDescription></CardHeader>
            <CardContent className="space-y-1.5 text-[13px]">
              {(recs?.plan ?? ["Day 1 · Study + quiz", "Day 2 · Weak topics + cards", "Day 3 · Mixed quiz + sheet", "Day 4 · Light review"]).map((d, i) => (
                <div key={d} className={cn("rounded-xl border px-3 py-2", i === 0 ? "border-foreground bg-muted" : "border-border")}>{d}</div>
              ))}
            </CardContent>
          </Card>
          {recs?.recommendations && recs.recommendations.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Recommended next</CardTitle><CardDescription>From your quiz history + notes — real misses only</CardDescription></CardHeader>
              <CardContent className="space-y-1.5 text-[13px]">
                {recs.recommendations.slice(0, 5).map((r) => (
                  <div key={`${r.action}-${r.topic}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                    <span className="min-w-0"><span className="block truncate font-medium">{r.topic}</span><span className="text-[12px] text-muted-foreground">{r.reason}</span></span>
                    {r.action.startsWith("quiz") ? (
                      <Button size="sm" variant="outline" asChild><Link href={`/quiz/setup?courseId=${encodeURIComponent(courseId)}${r.action === "quiz-easy" ? "&difficulty=easy" : r.action === "quiz-hard" ? "&difficulty=hard" : ""}`}>Quiz</Link></Button>
                    ) : r.action === "flashcards" ? (
                      <Button size="sm" variant="outline" asChild><Link href={`/flashcards?courseId=${encodeURIComponent(courseId)}`}>Cards</Link></Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={generate} disabled={generating}>Sheet</Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          </>
        )}
      </div>
    </div>
  );
}

export default function RevisionPage() {
  return (
    <Suspense>
      <RevisionInner />
    </Suspense>
  );
}
