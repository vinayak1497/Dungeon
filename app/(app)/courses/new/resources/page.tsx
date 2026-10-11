"use client";
import { Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, UploadCloud, FileText, FileImage, FileAudio, FileArchive, X, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";
import { useUploads } from "@/hooks/use-uploads";
import { formatBytes } from "@/lib/uploads";
import { cn } from "@/lib/utils";

function KindIcon({ kind }: { kind: string }) {
  if (kind === "image") return <FileImage className="size-4 shrink-0 text-muted-foreground" />;
  if (kind === "audio" || kind === "video") return <FileAudio className="size-4 shrink-0 text-muted-foreground" />;
  if (kind === "archive") return <FileArchive className="size-4 shrink-0 text-muted-foreground" />;
  return <FileText className="size-4 shrink-0 text-muted-foreground" />;
}

export default function ResourcesPage() {
  return (
    <Suspense>
      <ResourcesInner />
    </Suspense>
  );
}

function ResourcesInner() {
  const params = useSearchParams();
  const courseId = params.get("courseId") ?? "general";
  const { files, failed, loading, error, busy, overall, dragOver, setDragOver, uploadMany, remove, refresh, dismissFailed } = useUploads("resources", courseId);
  const input = useRef<HTMLInputElement>(null);
  const qs = courseId !== "general" ? `?courseId=${courseId}` : "";

  return (
    <div>
      <Topbar title="Add resources" crumbs={["Courses", "New", "Resources"]} />
      <div className="mx-auto max-w-xl px-5 py-6">
        <Rise>
          <div className="flex items-center justify-between">
            <Badge>Step 2 / 3</Badge>
            <span className="text-xs text-muted-foreground">
              {busy && overall !== null ? `${overall}% uploading` : `${files.length} stored`}
            </span>
          </div>
          {(busy || files.length > 0) && <Progress value={busy && overall !== null ? overall : 100} className="mt-2" />}

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>PDF · slides · Word · images · audio. Stored as your source material.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadMany(e.dataTransfer.files); }}
                className={cn(
                  "grid w-full place-items-center rounded-2xl border border-dashed bg-muted/50 py-6 text-center transition",
                  dragOver ? "border-foreground/50 bg-muted" : "border-border"
                )}
              >
                <UploadCloud className="size-5 text-muted-foreground" />
                <p className="mt-1 text-[13px] font-medium">{busy ? "Uploading…" : "Drop files here or browse"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Up to 20 files · 50 MB each</p>
              </button>
              <input
                ref={input}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.ppt,.pptx,.pps,.ppsx,.odp,.doc,.docx,.odt,.rtf,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp3,.wav,.m4a,.ogg,.flac,.mp4,.webm,.zip"
                onChange={(e) => { if (e.target.files) uploadMany(e.target.files); e.target.value = ""; }}
              />

              {error && (
                <p className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5" /> {error}
                  <button className="ml-auto underline" onClick={refresh}>Retry</button>
                </p>
              )}

              {failed.length > 0 && (
                <div className="space-y-1.5">
                  {failed.map((f) => (
                    <p key={f.name} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                      <AlertTriangle className="size-3.5 text-amber-600" />
                      <span className="min-w-0 flex-1 truncate"><span className="font-medium text-foreground">{f.name}</span> — {f.message}</span>
                      <button className="underline" onClick={dismissFailed}>Dismiss</button>
                    </p>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="animate-pulse rounded-xl border border-border p-3 text-[13px] text-muted-foreground">Loading stored files…</p>
              ) : files.length === 0 ? (
                <p className="rounded-xl border border-border p-3 text-[13px] text-muted-foreground">Nothing stored yet. Your uploads will appear here and feed mapping, canvas, quizzes and revision.</p>
              ) : (
                files.map((f) => (
                  <div key={f.path} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <KindIcon kind={f.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{f.name}</p>
                      <p className="text-[11px] text-muted-foreground">{f.kind} · {formatBytes(f.size)}</p>
                    </div>
                    <Badge tone="success">stored</Badge>
                    <a href={f.url} target="_blank" rel="noreferrer" aria-label="open file" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="size-4" />
                    </a>
                    <button aria-label="remove" className="text-muted-foreground hover:text-foreground" onClick={() => remove(f.path)}>
                      <X className="size-4" />
                    </button>
                  </div>
                ))
              )}

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" asChild><Link href="/courses/new"><ArrowLeft /> Back</Link></Button>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={refresh}><RefreshCw /> Refresh</Button>
                  <Button asChild><Link href={`/courses/new/mapping${qs}`}>Organize <ArrowRight /></Link></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Rise>
      </div>
    </div>
  );
}
