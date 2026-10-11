"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Play, RotateCcw, ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";
import { cn } from "@/lib/utils";

type Deck = { id: string; title: string; course_id: string | null; created_at: string; cards: number; due: number };
type FCard = { id: string; front: string; back: string; due_at: string | null };

const grades = [
  { label: "Again", value: "again" },
  { label: "Hard", value: "hard" },
  { label: "Good", value: "good" },
  { label: "Easy", value: "easy" },
] as const;

function FlashcardsInner() {
  const params = useSearchParams();
  const courseId = params.get("courseId") ?? "";
  const moduleId = params.get("moduleId") ?? "";
  const concept = params.get("concept") ?? "";

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksError, setDecksError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [cards, setCards] = useState<FCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const [studying, setStudying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [gradeBusy, setGradeBusy] = useState(false);
  const [gradeNote, setGradeNote] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    setDecksLoading(true);
    setDecksError(null);
    try {
      const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
      const res = await fetch(`/api/flashcards/decks${qs}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setDecksError(j?.error?.message ?? `Failed to load decks (${res.status}).`);
        return;
      }
      setDecks(j.decks ?? []);
    } catch {
      setDecksError("Failed to load decks.");
    } finally {
      setDecksLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const openDeck = useCallback(async (id: string, autostart = false) => {
    setActiveId(id);
    setCardsLoading(true);
    setCardsError(null);
    setIdx(0);
    setFlip(false);
    setReviewed(0);
    try {
      const res = await fetch(`/api/flashcards/decks/${encodeURIComponent(id)}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setCardsError(j?.error?.message ?? `Failed to load cards (${res.status}).`);
        return;
      }
      setCards(j.cards ?? []);
      if (autostart) setStudying(true);
    } catch {
      setCardsError("Failed to load cards.");
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const generate = async () => {
    if (!courseId || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, moduleId: moduleId || undefined, concept: concept || undefined, count: 12 }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setGenError(j?.error?.message ?? `Generation failed (${res.status}).`);
        return;
      }
      await loadDecks();
      await openDeck(j.deckId, true);
    } catch {
      setGenError("Generation failed. Check your connection and retry.");
    } finally {
      setGenerating(false);
    }
  };

  const grade = async (value: "again" | "hard" | "good" | "easy") => {
    const card = cards[idx];
    if (!card || gradeBusy) return;
    setGradeBusy(true);
    try {
      const res = await fetch("/api/flashcards/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, grade: value }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setGradeNote(j?.error?.message ?? "Review not saved.");
      } else {
        setGradeNote(`Saved · next review ${j.next ?? "scheduled"}.`);
        setReviewed((r) => r + 1);
      }
    } catch {
      setGradeNote("Review not saved — connection failed.");
    } finally {
      setGradeBusy(false);
      setFlip(false);
      setIdx((i) => i + 1);
    }
  };

  const active = decks.find((d) => d.id === activeId) ?? null;

  if (studying) {
    if (cardsLoading) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-6">
          <Card><CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading cards…</CardContent></Card>
        </div>
      );
    }
    if (cardsError || cards.length === 0) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-6">
          <Card><CardContent className="space-y-3 p-6 text-center">
            <p className="text-[15px] font-semibold">{cardsError ? "Couldn't load cards" : "Deck is empty"}</p>
            <p className="text-[13px] text-muted-foreground">{cardsError ?? "This deck has no cards yet."}</p>
            <Button size="sm" variant="outline" onClick={() => setStudying(false)}>Back to decks</Button>
          </CardContent></Card>
        </div>
      );
    }
    if (idx >= cards.length) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-6">
          <Card><CardContent className="space-y-3 p-6 text-center">
            <Badge tone="success">{reviewed} reviewed</Badge>
            <p className="text-[15px] font-semibold">Session complete</p>
            <p className="text-[13px] text-muted-foreground">Due cards resurface on their schedule.</p>
            <div className="flex justify-center gap-2">
              <Button size="sm" onClick={() => { setIdx(0); setFlip(false); setReviewed(0); }}>Restart</Button>
              <Button size="sm" variant="outline" onClick={() => { setStudying(false); setIdx(0); setFlip(false); loadDecks(); }}><RotateCcw /> End session</Button>
            </div>
          </CardContent></Card>
        </div>
      );
    }
    const card = cards[idx];
    return (
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={() => setStudying(false)}><X /> Exit</Button>
          <span className="text-xs text-muted-foreground">{idx + 1} / {cards.length}{reviewed > 0 ? ` · ${reviewed} graded` : ""}</span>
        </div>
        <Progress value={((idx + 1) / cards.length) * 100} className="mt-3" />
        <div className="mt-4 [perspective:1200px]">
          <motion.button
            onClick={() => setFlip(!flip)}
            animate={{ rotateY: flip ? 180 : 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative grid min-h-[240px] w-full place-items-center rounded-2xl border border-border bg-card p-6 text-center [transform-style:preserve-3d]"
          >
            <span className={cn("absolute inset-0 grid place-items-center p-6 text-[15px] font-medium [backface-visibility:hidden]", flip && "invisible")}>{card.front}</span>
            <span className="absolute inset-0 grid place-items-center p-6 text-[14px] text-muted-foreground [backface-visibility:hidden] [transform:rotateY(180deg)]">{card.back}</span>
          </motion.button>
          <p className="mt-2 text-center text-[12px] text-muted-foreground">Tap card to flip</p>
        </div>
        {gradeNote && <p className="mt-2 text-center text-[12px] text-muted-foreground">{gradeNote}</p>}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {grades.map((g) => (
            <Button key={g.value} size="sm" variant={g.value === "good" ? "default" : "outline"} disabled={gradeBusy} onClick={() => grade(g.value)}>{g.label}</Button>
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          <Button size="sm" variant="ghost" onClick={() => { setFlip(false); setIdx(Math.max(0, idx - 1)); }}><ChevronLeft /> Prev</Button>
          <Button size="sm" variant="ghost" onClick={() => { setFlip(false); setIdx(idx + 1); }}>Next <ChevronRight /></Button>
        </div>
        <div className="mt-3 text-center">
          <Button size="sm" variant="ghost" onClick={() => { setStudying(false); setIdx(0); setFlip(false); loadDecks(); }}><RotateCcw /> End session</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title="Flashcards"
        crumbs={["Learn", "Flashcards"]}
        actions={courseId ? <Button size="sm" onClick={generate} disabled={generating}><Plus /> {generating ? "Generating…" : "Generate deck"}</Button> : undefined}
      />
      <div className="mx-auto max-w-2xl space-y-3 px-5 py-6 md:px-8">
        <Rise>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-4 text-[13px]">
              {concept ? <Badge tone="accent">{concept}</Badge> : <Badge>Decks</Badge>}
              <span className="text-muted-foreground">
                {!courseId ? "Showing all your decks — open from a course to generate." : `Decks for this course${concept ? ` · ${concept}` : ""}.`}
              </span>
            </CardContent>
          </Card>
        </Rise>
        {genError && <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[13px] text-amber-700">{genError}</p>}
        {decksLoading && (
          <Card><CardContent className="py-8 text-center text-[13px] text-muted-foreground">Loading decks…</CardContent></Card>
        )}
        {!decksLoading && decksError && (
          <Card><CardContent className="space-y-2 p-6 text-center">
            <p className="text-[13px] text-muted-foreground">{decksError}</p>
            <Button size="sm" variant="outline" onClick={loadDecks}>Retry</Button>
          </CardContent></Card>
        )}
        {!decksLoading && !decksError && decks.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold tracking-tight">No decks yet</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {!courseId ? "Open flashcards from a course page to generate your first deck." : "Generate a deck from your course material to start studying."}
              </p>
              {courseId ? (
                <Button className="mt-4" onClick={generate} disabled={generating}><Play /> {generating ? "Generating…" : "Generate deck"}</Button>
              ) : (
                <Button className="mt-4" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
              )}
            </CardContent>
          </Card>
        )}
        {!decksLoading && !decksError && decks.length > 0 && (
          <div className="space-y-2">
            {decks.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate">{d.title}</CardTitle>
                    <Badge tone={d.due > 0 ? "warn" : "success"}>{d.due} due</Badge>
                  </div>
                  <CardDescription>{d.cards} cards</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" onClick={() => openDeck(d.id, true)}><Play /> Study</Button>
                  <Button size="sm" variant="outline" onClick={() => openDeck(d.id, false)}>Preview</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {active && cards.length > 0 && !studying && !cardsLoading && (
          <Rise>
            <Card>
              <CardHeader><CardTitle>{active.title}</CardTitle><CardDescription>{cards.length} cards loaded</CardDescription></CardHeader>
              <CardContent>
                <Button size="sm" onClick={() => setStudying(true)}><Play /> Start session</Button>
              </CardContent>
            </Card>
          </Rise>
        )}
        {cardsLoading && active && <p className="text-center text-[12px] text-muted-foreground">Loading cards…</p>}
        {cardsError && active && <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-[13px] text-amber-700">{cardsError}</p>}
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  return (
    <Suspense>
      <FlashcardsInner />
    </Suspense>
  );
}
