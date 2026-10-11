"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, PenSquare, Sparkles, ChevronDown, X, Youtube, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, SourceChip } from "@/components/ui/meta";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";

type Structure = {
  course: { id: string; title: string; code: string | null };
  modules: { id: string; title: string; position: number; status: string }[];
  concepts: { id: string; module_id: string; title: string; status: string }[];
  resources: { id: string; filename: string; kind: string | null; scope: string | null; status: string | null }[];
  assignments: { resource_id: string; module_id: string; state: string }[];
};

type Video = { id: string; title: string; channel: string; thumbnail: string; duration: string | null; url: string };
type Citation = { n: number; filename: string; page_no: number | null };
type AskOk = { grounded: true; status: string; answer: string; citations: Citation[]; provider?: string };
type AskNo = { grounded: false; status: string; answer: string | null; message: string; citations: Citation[]; provider?: string };
type AskRes = AskOk | AskNo;

type AiMode = "Explain" | "Summarize" | "Practice";

const questionFor = (mode: AiMode, title: string) =>
  mode === "Explain" ? `Explain ${title} in simple terms` : mode === "Summarize" ? `Summarize ${title} in 3 bullets` : `Give me a practice question on ${title}`;

export default function ConceptPage({ params }: { params: { courseId: string; conceptId: string } }) {
  const { courseId, conceptId } = params;
  const [aiOpen, setAiOpen] = useState(true);
  const [mode, setMode] = useState<AiMode>("Explain");
  const [data, setData] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askRes, setAskRes] = useState<AskRes | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [vUnavailable, setVUnavailable] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/structure`);
        if (res.status === 404) {
          setError("Course not found.");
          return;
        }
        if (res.status === 401) {
          setError("Sign in required.");
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          setError(j?.error?.message ?? "Failed to load concept.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Failed to load concept.");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const concept = data?.concepts.find((c) => c.id === conceptId) ?? null;
  const parentModule = concept ? (data?.modules.find((m) => m.id === concept.module_id) ?? null) : null;

  useEffect(() => {
    if (!concept) return;
    (async () => {
      setVLoading(true);
      setVUnavailable(null);
      try {
        const res = await fetch(`/api/videos?concept=${encodeURIComponent(concept.title)}`);
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
  }, [concept?.title]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || !concept || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, moduleId: concept.module_id, question: text, concept: concept.title }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setAskError(j?.error?.message ?? "Ask failed.");
        return;
      }
      setAskRes(j as AskRes);
    } catch {
      setAskError("Ask failed.");
    } finally {
      setAsking(false);
    }
  };

  const quickAsk = (m: AiMode) => {
    if (!concept) return;
    setMode(m);
    setAiOpen(true);
    const q = questionFor(m, concept.title);
    setQuestion(q);
    ask(q);
  };

  if (loading) {
    return (
      <div>
        <Topbar title="Loading…" crumbs={["Courses", courseId, conceptId]} />
        <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
          <Card>
            <CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading concept…</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Topbar title="Error" crumbs={["Courses", courseId, conceptId]} />
        <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Couldn&apos;t load concept</CardTitle>
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

  if (!concept) {
    return (
      <div>
        <Topbar title="Not found" crumbs={["Courses", courseId, conceptId]} />
        <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Concept not found</CardTitle>
              <CardDescription>No concept with this id in this course.</CardDescription>
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

  const assignedIds = parentModule ? data.assignments.filter((a) => a.module_id === parentModule.id).map((a) => a.resource_id) : [];
  const original = data.resources.find((r) => assignedIds.includes(r.id)) ?? data.resources[0] ?? null;

  return (
    <div>
      <Topbar
        title={concept.title}
        crumbs={["Courses", parentModule?.title ?? courseId, concept.title]}
        actions={
          <div className="flex items-center gap-2">
            {parentModule && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/courses/${courseId}/modules/${parentModule.id}`}>Back</Link>
              </Button>
            )}
            <Badge>{concept.status}</Badge>
          </div>
        }
      />
      <div className="mx-auto max-w-3xl space-y-3 px-5 py-6 md:px-8">
        <Rise className="flex flex-wrap gap-2">
          {original && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/courses/${courseId}/resources/${original.id}`}>
                <FileText /> Open original
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/canvas/new?courseId=${courseId}`}>
              <PenSquare /> Open in Canvas
            </Link>
          </Button>
          {(["Explain", "Summarize", "Practice"] as AiMode[]).map((m) => (
            <Button key={m} size="sm" variant={mode === m && aiOpen ? "default" : "secondary"} onClick={() => quickAsk(m)}>
              <Sparkles /> {m}
            </Button>
          ))}
        </Rise>

        <Rise>
          <Card>
            <button onClick={() => setAiOpen((v) => !v)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" /> Grounded Q&A
              </span>
              {aiOpen ? <X className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <AnimatePresence initial={false}>
              {aiOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                  <CardContent className="space-y-2.5 border-t border-border pt-3">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        ask(question);
                      }}
                    >
                      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={`Ask about ${concept.title}…`} aria-label="Question" />
                      <Button size="sm" type="submit" disabled={asking || !question.trim()}>
                        <Send /> {asking ? "Asking…" : "Ask"}
                      </Button>
                    </form>
                    {askError && <p className="text-[13px] text-muted-foreground">{askError}</p>}
                    {!askRes && !askError && <p className="text-[13px] text-muted-foreground">Answers cite your uploads only.</p>}
                    {askRes && !askRes.grounded && (
                      <div className="space-y-2">
                        <p className="text-[13.5px] leading-relaxed text-foreground/80">{askRes.message}</p>
                        {askRes.answer && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/80">{askRes.answer}</p>}
                        {askRes.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {askRes.citations.map((c) => (
                              <SourceChip key={c.n} label={c.page_no != null ? `${c.filename} p.${c.page_no}` : c.filename} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {askRes?.grounded && (
                      <div className="space-y-2">
                        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/80">{(askRes as AskOk).answer}</p>
                        {(askRes as AskOk).citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(askRes as AskOk).citations.map((c) => (
                              <SourceChip key={c.n} label={c.page_no != null ? `${c.filename} p.${c.page_no}` : c.filename} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="size-4" /> Videos
              </CardTitle>
              <CardDescription>Curated for {concept.title}.</CardDescription>
            </CardHeader>
            <CardContent>
              {vLoading && <p className="text-[13px] text-muted-foreground">Loading videos…</p>}
              {!vLoading && vUnavailable && <p className="text-[13px] text-muted-foreground">{vUnavailable}</p>}
              {!vLoading && !vUnavailable && videos.length === 0 && <p className="text-[13px] text-muted-foreground">No videos found.</p>}
              {!vLoading && !vUnavailable && videos.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {videos.map((v) => (
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
            </CardContent>
          </Card>
        </Rise>
      </div>
    </div>
  );
}
