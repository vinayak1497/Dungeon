"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, RefreshCw, AlertTriangle, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";
import { cn } from "@/lib/utils";

type Mod = { id: string; title: string; position: number; status: string };
type Concept = { id: string; module_id: string; title: string };
type Res = { id: string; filename: string; kind: string | null; scope: string; status: string };
type Assign = { resource_id: string; module_id: string; state: string; confidence?: string };

function MappingInner() {
  const params = useSearchParams();
  const router = useRouter();
  const courseId = params.get("courseId") ?? "";
  const [mods, setMods] = useState<Mod[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [resources, setResources] = useState<Res[]>([]);
  const [assigns, setAssigns] = useState<Assign[]>([]);
  const [status, setStatus] = useState<string>("none");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/courses/${courseId}/structure`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Load failed.");
      setMods(j.modules ?? []);
      setConcepts(j.concepts ?? []);
      setResources((j.resources ?? []).filter((x: Res) => x.scope === "resources" || x.scope === "syllabus"));
      setAssigns(j.assignments ?? []);
      setStatus(j.course?.syllabus_status ?? "none");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  async function classify() {
    setClassifying(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch("/api/syllabus/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Classification failed.");
      const parts: string[] = [];
      const aiCount = (j.assignments ?? []).length;
      const autoCount = (j.autoAssigned ?? []).length;
      const sylCount = (j.syllabus ?? []).length;
      const unCount = (j.unmapped ?? []).length;
      if (aiCount > 0) parts.push(`${aiCount} AI suggestion${aiCount === 1 ? "" : "s"}`);
      if (autoCount > 0) parts.push(`${autoCount} auto-matched${j.aiFallback ? " (AI unavailable — keyword match)" : ""}`);
      if (sylCount > 0) parts.push(`${sylCount} detected as syllabus (${(j.syllabus ?? []).map((s: { filename: string }) => s.filename).join(", ")})`);
      if (parts.length > 0) setNotice(`Classified: ${parts.join(" · ")}.${unCount > 0 ? ` ${unCount} still unassigned — assign manually below.` : " All files assigned."}`);
      else if (unCount > 0) setNotice(`${unCount} file${unCount === 1 ? "" : "s"} had no topical fit — assign manually below.`);
      else setNotice("Nothing new to classify.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification failed.");
    } finally {
      setClassifying(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const r = await fetch("/api/syllabus/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Analysis failed.");
      setWarnings(j.warnings ?? []);
      await load();
      // Auto-classify uploaded PDFs into the fresh structure.
      await classify();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function ingest(id: string) {
    try {
      const r = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId: id })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Processing failed.");
      if (j.autoAssign?.status === "assigned") setNotice(`Processed and auto-filed into its module (${j.autoAssign.confidence} confidence).`);
      else if (j.autoAssign?.status === "syllabus") setNotice(`Processed — detected as a syllabus file, kept out of module mapping.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    }
  }

  function assign(resource_id: string, module_id: string) {
    setAssigns((a) => [...a.filter((x) => x.resource_id !== resource_id), { resource_id, module_id, state: "confirmed" }]);
  }

  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const r = await fetch(`/api/courses/${courseId}/structure`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modules: mods.map((m, i) => ({
            id: m.id,
            title: m.title,
            position: i,
            topics: concepts.filter((c) => c.module_id === m.id).map((c) => ({ id: c.id, title: c.title }))
          })),
          assignments: assigns.map((a) => ({ resource_id: a.resource_id, module_id: a.module_id })),
          confirm: true
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Confirm failed.");
      router.push(`/courses/${courseId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed.");
    } finally {
      setConfirming(false);
    }
  }

  if (!courseId) {
    return (
      <div>
        <Topbar title="Organize" crumbs={["Courses", "New", "Mapping"]} />
        <div className="mx-auto max-w-2xl px-5 py-6">
          <Card><CardContent className="p-5 text-sm text-muted-foreground">Create the course first — <Link href="/courses/new" className="underline">back to step 1</Link>.</CardContent></Card>
        </div>
      </div>
    );
  }

  const assignedIds = new Set(assigns.map((a) => a.resource_id));
  const suggestedCount = assigns.filter((a) => a.state === "suggested").length;
  const unassigned = resources.filter((r) => r.scope === "resources" && !assignedIds.has(r.id));
  const resName = (id: string) => resources.find((r) => r.id === id)?.filename ?? "file";

  return (
    <div>
      <Topbar title="Organize" crumbs={["Courses", "New", "Mapping"]} />
      <div className="mx-auto max-w-2xl px-5 py-6">
        <Rise>
          <div className="flex items-center justify-between"><Badge>Step 3 / 3</Badge><span className="text-xs text-muted-foreground">{status.replace("_", " ")}</span></div>
          <Progress value={status === "confirmed" ? 100 : 90} className="mt-2" />
        </Rise>

        {error && <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"><AlertTriangle className="size-3.5" /> {error}</p>}
        {notice && <p className="mt-3 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-foreground/80">{notice}</p>}

        {loading ? (
          <p className="mt-4 animate-pulse rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading structure…</p>
        ) : mods.length === 0 ? (
          <Card className="mt-4">
            <CardHeader><CardTitle>No structure yet</CardTitle><CardDescription>Extract modules from your syllabus to organize resources under the official structure.</CardDescription></CardHeader>
            <CardContent>
              {warnings.map((w) => <p key={w} className="mb-2 text-[13px] text-muted-foreground">• {w}</p>)}
              <Button onClick={analyze} disabled={analyzing}>
                {analyzing ? <><Loader2 className="animate-spin" /> Analyzing syllabus…</> : <><Sparkles /> Extract from syllabus</>}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 space-y-2">
            {warnings.map((w) => <p key={w} className="rounded-xl border border-border px-3 py-2 text-[13px] text-muted-foreground">• {w}</p>)}
            {mods.map((m) => {
              const topics = concepts.filter((c) => c.module_id === m.id);
              const assigned = assigns.filter((a) => a.module_id === m.id);
              const expanded = open === m.id;
              return (
                <Card key={m.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setOpen(expanded ? null : m.id)} aria-label="expand" className="text-muted-foreground hover:text-foreground">
                        <ChevronDown className={cn("size-4 transition", expanded && "rotate-180")} />
                      </button>
                      <div className="min-w-0 flex-1">
                        {expanded ? (
                          <Input value={m.title} onChange={(e) => setMods((v) => v.map((x) => x.id === m.id ? { ...x, title: e.target.value } : x))} className="h-8 text-sm" />
                        ) : (
                          <p className="truncate text-sm font-medium">{m.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{topics.length} topics · {assigned.length} resources</p>
                        {expanded && assigned.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {assigned.map((a) => (
                              <span key={a.resource_id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                                {resName(a.resource_id)}
                                {a.state === "suggested" && (
                                  <em className="not-italic text-accent">· AI{a.confidence && a.confidence !== "review" ? ` ${a.confidence}` : ""}</em>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge tone="accent">{assigned.length} files</Badge>
                    </div>
                    {expanded && (
                      <div className="mt-2 space-y-1 pl-7">
                        {topics.map((t) => (
                          <Input key={t.id} value={t.title} onChange={(e) => setConcepts((v) => v.map((x) => x.id === t.id ? { ...x, title: e.target.value } : x))} className="h-8 text-[13px]" />
                        ))}
                        {topics.length === 0 && <p className="text-xs text-muted-foreground">No topics extracted — add some on the module page later.</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {mods.length > 0 && (
          <Card className="mt-3 border-dashed">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Unassigned</CardTitle><CardDescription>{unassigned.length} files need a home{suggestedCount > 0 ? ` · ${suggestedCount} AI suggestions await confirm` : ""} · failed files can be retried</CardDescription></div>
                <Button size="sm" variant="outline" onClick={classify} disabled={classifying}>
                  {classifying ? <><Loader2 className="animate-spin" /> Classifying…</> : <><Sparkles /> Auto-classify PDFs</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {resources.filter((r) => r.status === "failed").map((r) => (
                <p key={r.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <AlertTriangle className="size-3.5 text-amber-600" /> {r.filename}
                  <button className="underline" onClick={() => ingest(r.id)}>retry processing</button>
                </p>
              ))}
              {unassigned.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Badge>{r.filename}</Badge>
                  <select
                    aria-label={`Assign ${r.filename}`}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-[12px]"
                    defaultValue=""
                    onChange={(e) => e.target.value && assign(r.id, e.target.value)}
                  >
                    <option value="">Assign to…</option>
                    {mods.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              ))}
              {unassigned.length === 0 && <p className="text-[13px] text-muted-foreground">All files assigned.</p>}
            </CardContent>
          </Card>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" asChild><Link href={courseId ? `/courses/new/resources?courseId=${courseId}` : "/courses/new/resources"}><ArrowLeft /> Back</Link></Button>
          <div className="flex gap-2">
            {mods.length === 0 && <Button variant="outline" onClick={analyze} disabled={analyzing}><RefreshCw /> Retry analysis</Button>}
            <Button onClick={confirm} disabled={confirming || mods.length === 0}>
              {confirming ? <><Loader2 className="animate-spin" /> Saving…</> : <><Check /> Confirm</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MappingPage() {
  return (
    <Suspense>
      <MappingInner />
    </Suspense>
  );
}
