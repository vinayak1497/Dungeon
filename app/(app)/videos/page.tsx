"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Play, Clock, Youtube, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/meta";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";

type Video = { id: string; title: string; channel: string; thumbnail: string; duration: string | null; url: string };

function formatDuration(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return iso;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

function VideosInner() {
  const params = useSearchParams();
  const initialConcept = params.get("concept") ?? "";
  const courseId = params.get("courseId") ?? "";

  const [concept, setConcept] = useState(initialConcept);
  const [input, setInput] = useState(initialConcept);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async (c: string) => {
    const q = c.trim();
    if (!q) {
      setVideos([]);
      setUnavailable(null);
      return;
    }
    setLoading(true);
    setUnavailable(null);
    setError(null);
    try {
      const res = await fetch(`/api/videos?concept=${encodeURIComponent(q)}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setError(j?.error?.message ?? `Video search failed (${res.status}).`);
        return;
      }
      if (j?.unavailable) {
        setUnavailable(j.reason ?? "Videos unavailable.");
        setVideos([]);
      } else {
        setVideos(j?.videos ?? []);
      }
    } catch {
      setError("Video search failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setConcept(initialConcept);
    setInput(initialConcept);
    if (initialConcept) fetchVideos(initialConcept);
  }, [initialConcept, fetchVideos]);

  const backHref = courseId ? `/courses/${courseId}` : "/dashboard";

  return (
    <div>
      <Topbar title="Videos" crumbs={["Learn", "Videos"]} actions={<Button size="sm" variant="ghost" asChild><Link href={backHref}>Back</Link></Button>} />
      <div className="mx-auto max-w-5xl px-5 py-6 md:px-8">
        <Rise>
          <Card>
            <CardContent className="space-y-2.5 p-4 text-[13px]">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setConcept(input.trim());
                  fetchVideos(input);
                }}
              >
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search a concept…" aria-label="Concept" />
                <Button size="sm" type="submit" disabled={loading || !input.trim()}><Search /> {loading ? "Searching…" : "Search"}</Button>
              </form>
              <div className="flex flex-wrap items-center gap-2">
                {concept ? <Badge tone="accent">{concept}</Badge> : <Badge>Videos</Badge>}
                <span className="text-muted-foreground">{concept ? "Curated for this concept." : "Enter a concept to find videos."}</span>
              </div>
            </CardContent>
          </Card>
        </Rise>

        {!concept ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="grid h-32 place-items-center rounded-2xl border border-border bg-card"><Youtube className="size-8 text-muted-foreground" /></div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">Search a concept</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recommendations come from YouTube, matched to your concept.</p>
          </div>
        ) : loading ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">Searching videos…</p>
        ) : error ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <h2 className="text-lg font-semibold tracking-tight">Search failed</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button size="sm" className="mt-4" variant="outline" onClick={() => fetchVideos(concept)}>Retry</Button>
          </div>
        ) : unavailable ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="grid h-32 place-items-center rounded-2xl border border-border bg-card"><Youtube className="size-8 text-muted-foreground" /></div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">Videos unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">{unavailable}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Setup hint: configure the YouTube API key, then retry.</p>
            <Button size="sm" className="mt-4" variant="outline" asChild><Link href={backHref}>Back</Link></Button>
          </div>
        ) : videos.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="grid h-32 place-items-center rounded-2xl border border-border bg-card"><Youtube className="size-8 text-muted-foreground" /></div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">No videos found</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nothing matched this concept. Try another phrase.</p>
          </div>
        ) : (
          <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <Item key={v.id}>
                <Card className="card-hover overflow-hidden">
                  {v.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail} alt={v.title} className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="grid aspect-video place-items-center bg-gradient-to-br from-muted to-muted/60">
                      <span className="grid size-10 place-items-center rounded-full bg-white/90"><Play className="size-4" /></span>
                    </div>
                  )}
                  <CardHeader className="pb-1">
                    <CardTitle className="line-clamp-2">{v.title}</CardTitle>
                    <CardDescription>
                      {v.channel}
                      {formatDuration(v.duration) ? <> · <Clock className="mr-0.5 inline size-3" />{formatDuration(v.duration)}</> : null}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <a href={v.url} target="_blank" rel="noreferrer"><Play /> Watch</a>
                    </Button>
                  </CardContent>
                </Card>
              </Item>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense>
      <VideosInner />
    </Suspense>
  );
}
