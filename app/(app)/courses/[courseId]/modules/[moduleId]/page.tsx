"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, ArrowRight, FileText, Check, Lock, PenSquare, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";

type Structure = {
  course: { id: string; title: string; code: string | null };
  modules: { id: string; title: string; position: number; status: string }[];
  concepts: { id: string; module_id: string; title: string; status: string }[];
  resources: { id: string; filename: string; kind: string | null; scope: string | null; status: string | null }[];
  assignments: { resource_id: string; module_id: string; state: string }[];
};

type Video = { id: string; title: string; channel: string; thumbnail: string; duration: string | null; relevance?: number; url: string };

const tabs = ["Concepts", "Resources"] as const;
const progressFor = (s: string) => (s === "done" ? 100 : s === "active" ? 45 : 0);

export default function ModulePage({ params }: { params: { courseId: string; moduleId: string } }) {
  const { courseId, moduleId } = params;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Concepts");
  const [data, setData] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [vUnavailable, setVUnavailable] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumError, setSumError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/structure`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (res.status === 401) {
          setError("Sign in required.");
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          setError(j?.error?.message ?? "Failed to load module.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Failed to load module.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const mod = data?.modules.find((m) => m.id === moduleId) ?? null;

  useEffect(() => {
    if (!mod) return;
    (async () => {
      setVLoading(true);
      setVUnavailable(null);
      try {
        const res = await fetch(`/api/videos?concept=${encodeURIComponent(mod.title)}&context=${encodeURIComponent(data?.course.title ?? "")}`);
        const j = await res.json().catch(() => null);
        if (j?.unavailable) {
          setVUnavailable(j.reason ?? "Videos unavailable.");
          setVideos([]);
        } else {
          setVideos(j?.videos ?? []);
        }
      } catch {
        setVUnavailable("Video search failed.");
      } finally {
        setVLoading(false);
      }
    })();
  }, [mod?.title, data?.course.title]);

  async function summarize() {
    if (!mod || sumLoading) return;
    setSumLoading(true);
    setSumError(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, moduleId: mod.id, question: `Summarize this module in plain language: key ideas, definitions, and what to practice first. Module: ${mod.title}` })
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message ?? "Summary failed.");
      if (!j?.grounded) {
        setSumError(j?.message ?? "No supporting material for this module yet.");
        return;
      }
      setSummary(j.answer);
    } catch (e) {
      setSumError(e instanceof Error ? e.message : "Summary failed.");
    } finally {
      setSumLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Topbar title="Loading…" crumbs={["Courses", courseId, moduleId]} />
        <div className="mx-auto max-w-4xl px-5 py-6 md:px-8">
          <Card>
            <CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading module…</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Topbar title="Error" crumbs={["Courses", courseId, moduleId]} />
        <div className="mx-auto max-w-4xl px-5 py-6 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Couldn&apos;t load module</CardTitle>
              <CardDescription>{error ?? "Unknown error."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/courses/${courseId}`}>Back to course</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!mod) {
    return (
      <div>
        <Topbar title="Not found" crumbs={["Courses", courseId, moduleId]} />
        <div className="mx-auto max-w-4xl px-5 py-6 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Module not found</CardTitle>
              <CardDescription>No module with this id in this course.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/courses/${courseId}`}>Back to course</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const moduleConcepts = data.concepts.filter((c) => c.module_id === mod.id);
  const assignedIds = new Set(data.assignments.filter((a) => a.module_id === mod.id).map((a) => a.resource_id));
  const moduleResources = data.resources.filter((r) => assignedIds.has(r.id));
  const shownResources = moduleResources.length > 0 ? moduleResources : data.resources;
  const firstConcept = moduleConcepts[0] ?? null;
  const q = encodeURIComponent(mod.title);

  return (
    <div>
      <Topbar
        title={mod.title}
        crumbs={["Courses", data.course.code ?? courseId, mod.title]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/courses/${courseId}`}>Back</Link>
            </Button>
            {firstConcept && (
              <Button size="sm" asChild>
                <Link href={`/courses/${courseId}/concepts/${firstConcept.id}`}>
                  <Play /> {mod.status === "done" ? "Review" : "Start"}
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6 md:px-8">
        <Rise>
          <Card>
            <CardHeader>
              <Badge tone={mod.status === "active" ? "accent" : "neutral"}>{mod.status}</Badge>
              <CardDescription>
                {moduleConcepts.length} concepts · {moduleResources.length} resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressFor(mod.status)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href={`/quiz/setup?courseId=${courseId}&moduleId=${mod.id}&concept=${q}`}>
                    <Play /> Practice
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/flashcards?courseId=${courseId}&moduleId=${mod.id}&concept=${q}`}>Flashcards</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/revision?courseId=${courseId}&moduleId=${mod.id}&concept=${q}`}>Revise</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/canvas/new?courseId=${courseId}`}>
                    <PenSquare /> Canvas
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <CardHeader>
              <CardTitle>Module summary</CardTitle>
              <CardDescription>Grounded in this module&apos;s PDFs.</CardDescription>
            </CardHeader>
            <CardContent>
              {!summary && !sumLoading && (
                <Button size="sm" onClick={summarize}><Play /> Summarize this module</Button>
              )}
              {sumLoading && <p className="animate-pulse text-[13px] text-muted-foreground">Summarizing from your PDFs…</p>}
              {sumError && <p className="text-[13px] text-amber-700">{sumError}</p>}
              {summary && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{summary}</p>}
            </CardContent>
          </Card>
        </Rise>

        <Rise className="flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${tab === t ? "bg-foreground text-background" : "bg-muted text-foreground/70 hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </Rise>

        {tab === "Concepts" && (
          <Stagger className="space-y-2">
            {moduleConcepts.length === 0 && (
              <Card>
                <CardContent className="py-6 text-[13px] text-muted-foreground">No concepts in this module yet.</CardContent>
              </Card>
            )}
            {moduleConcepts.map((c) => (
              <Item key={c.id}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                    {c.status === "mastered" || c.status === "done" ? <Check className="size-4" /> : <Lock className="size-4 opacity-40" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <Badge className="mt-1">{c.status}</Badge>
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/courses/${courseId}/concepts/${c.id}`}>
                      Open <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </Item>
            ))}
          </Stagger>
        )}

        {tab === "Resources" && (
          <div className="space-y-2">
            {shownResources.length === 0 && (
              <Card>
                <CardContent className="py-6 text-[13px] text-muted-foreground">No resources yet.</CardContent>
              </Card>
            )}
            {shownResources.map((r) => (
              <Link key={r.id} href={`/courses/${courseId}/resources/${r.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:bg-muted">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.filename}</span>
                  <span className="text-xs text-muted-foreground">
                    {[r.kind, r.scope, r.status].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}

        <Rise>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="size-4" /> Videos
              </CardTitle>
              <CardDescription>Curated for {mod.title}.</CardDescription>
            </CardHeader>
            <CardContent>
              {vLoading && <p className="text-[13px] text-muted-foreground">Loading videos…</p>}
              {!vLoading && vUnavailable && <p className="text-[13px] text-muted-foreground">{vUnavailable}</p>}
              {!vLoading && !vUnavailable && videos.length === 0 && <p className="text-[13px] text-muted-foreground">No videos found.</p>}
              {!vLoading && !vUnavailable && videos.length > 0 && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-xl border border-border">
                    <iframe
                      title={videos[0].title}
                      src={`https://www.youtube-nocookie.com/embed/${videos[0].id}`}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <p className="truncate text-[13px] font-medium">{videos[0].title} <span className="font-normal text-muted-foreground">· {videos[0].channel}</span></p>
                  {videos.length > 1 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {videos.slice(1).map((v) => (
                        <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-border transition hover:bg-muted">
                          {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="aspect-video w-full object-cover" />}
                          <span className="block p-2.5">
                            <span className="block truncate text-[13px] font-medium">{v.title}</span>
                            <span className="text-[11.5px] text-muted-foreground">
                              {v.channel}
                              {v.duration ? ` · ${v.duration}` : ""}
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </Rise>
      </div>
    </div>
  );
}
