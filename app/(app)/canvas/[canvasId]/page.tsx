"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  Type,
  Shapes,
  MoveUpRight,
  Lasso,
  Undo2,
  Redo2,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  Plus,
  ChevronDown,
  X,
  Sparkles,
  PanelLeft,
  PanelRight,
  Check,
  Copy,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, SourceChip } from "@/components/ui/meta";
import { Input } from "@/components/ui/input";
import { InkLayer } from "@/components/canvas/ink-layer";
import { coerceDoc, type Stroke, type Shape } from "@/lib/canvas/doc";
import { REFINE_MODES, REFINE_LABELS, type RefineMode } from "@/lib/ai/refine";
import { cn } from "@/lib/utils";

type Block = { id: string; text: string };
type AiView = "idle" | "answer" | "review" | "insufficient";
type Ctx = "Selection" | "Page" | "Project" | "Course";
type PageItem = { id: string; title: string; position: number };
type Citation = { n: number; filename: string; page_no: number | null };

const tools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "pen", icon: Pen, label: "Pen" },
  { id: "highlighter", icon: Highlighter, label: "Highlighter" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "text", icon: Type, label: "Text" },
  { id: "shapes", icon: Shapes, label: "Shapes" },
  { id: "arrow", icon: MoveUpRight, label: "Arrow" },
  { id: "lasso", icon: Lasso, label: "Lasso" },
];

const colors = ["#17171a", "#4f43e8", "#0e9f6e", "#d97706", "#dc2626"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `b${Date.now()}${Math.floor(Math.random() * 1e6)}`);

function CanvasInner({ canvasId }: { canvasId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const queryCourseId = search.get("courseId") ?? "";

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<{ id: string; course_id: string | null; title: string } | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  const [title, setTitle] = useState("Untitled canvas");
  const [saved, setSaved] = useState<"Saving" | "Saved">("Saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(colors[0]);
  const [thick, setThick] = useState(2);
  const [styleOpen, setStyleOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [menuOpen, setMenuOpen] = useState(false);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [inkSel, setInkSel] = useState<string[]>([]);
  const [strokePast, setStrokePast] = useState<Stroke[][]>([]);
  const [strokeFuture, setStrokeFuture] = useState<Stroke[][]>([]);
  const [past, setPast] = useState<Block[][]>([]);
  const [future, setFuture] = useState<Block[][]>([]);
  const [selection, setSelection] = useState("");
  const [selectionBlock, setSelectionBlock] = useState<string | null>(null);
  const [printAll, setPrintAll] = useState<{ id: string; title: string; doc: unknown }[] | null>(null);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [pagesOpen, setPagesOpen] = useState(true);

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [ctx, setCtx] = useState<Ctx>("Page");
  const [aiView, setAiView] = useState<AiView>("idle");
  const [chat, setChat] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiCitations, setAiCitations] = useState<Citation[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ refined: string; note: string } | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  const effectiveCourseId = queryCourseId || project?.course_id || "";

  const applyPage = useCallback((p: { id: string; title: string; doc?: unknown }, siblings: PageItem[]) => {
    const doc = coerceDoc(p.doc);
    setBlocks(doc.elements.map((e) => ({ id: e.id, text: e.text })));
    setStrokes(doc.strokes ?? []);
    setShapes(doc.shapes ?? []);
    setInkSel([]);
    setPast([]);
    setFuture([]);
    setStrokePast([]);
    setStrokeFuture([]);
    setSelection("");
    setSelectionBlock(null);
    setTitle(p.title);
    setPageId(p.id);
    setPages(siblings);
    skipSave.current = true;
    setSaved("Saved");
  }, []);

  // Initial load: "new" creates a project; a UUID is a project id (first page);
  // anything else is attempted as a page id (legacy links).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (canvasId === "new") {
          if (!queryCourseId) {
            setError("Pick a course first — open Canvas from a course page so it has a home.");
            setPhase("error");
            return;
          }
          const res = await fetch("/api/canvas", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ courseId: queryCourseId, title: "Untitled canvas" }),
          });
          const j = await res.json().catch(() => null);
          if (!res.ok || !j?.project) {
            setError(j?.error?.message ?? `Couldn't create canvas (${res.status}).`);
            setPhase("error");
            return;
          }
          try {
            sessionStorage.setItem(`canvas-project-${j.project.id}`, j.page?.id ?? "");
          } catch { /* ignore */ }
          router.replace(`/canvas/${j.project.id}?courseId=${encodeURIComponent(queryCourseId)}`);
          return;
        }

        if (UUID_RE.test(canvasId)) {
          const res = await fetch(`/api/canvas/projects/${encodeURIComponent(canvasId)}`);
          const j = await res.json().catch(() => null);
          if (res.ok && j?.project) {
            if (cancelled) return;
            // Known page from this browser? Load it so siblings arrive together.
            let cached: string | null = null;
            try {
              cached = sessionStorage.getItem(`canvas-project-${j.project.id}`);
            } catch { /* ignore */ }
            if (cached) {
              const pr = await fetch(`/api/canvas/pages/${encodeURIComponent(cached)}`);
              const pj = await pr.json().catch(() => null);
              if (pr.ok && pj?.page && !cancelled) {
                setProject(j.project);
                applyPage(pj.page, pj.pages ?? []);
                setPhase("ready");
                return;
              }
            }
            if (!j.page) {
              // Project exists but has no pages — create its first page.
              const cr = await fetch("/api/canvas", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ projectId: j.project.id, pageTitle: "Page 1" }),
              });
              const cj = await cr.json().catch(() => null);
              if (!cr.ok || !cj?.page) {
                setError(cj?.error?.message ?? "Canvas has no pages and a first page couldn't be created.");
                setPhase("error");
                return;
              }
              if (cancelled) return;
              setProject(j.project);
              const lr = await fetch(`/api/canvas/pages/${encodeURIComponent(cj.page.id)}`);
              const lj = await lr.json().catch(() => null);
              if (!lr.ok || !lj?.page) {
                setError("First page was created but couldn't be loaded. Retry.");
                setPhase("error");
                return;
              }
              try {
                sessionStorage.setItem(`canvas-project-${j.project.id}`, lj.page.id);
              } catch { /* ignore */ }
              applyPage(lj.page, lj.pages ?? []);
              setPhase("ready");
              return;
            }
            if (cancelled) return;
            setProject(j.project);
            try {
              sessionStorage.setItem(`canvas-project-${j.project.id}`, j.page.id);
            } catch { /* ignore */ }
            const full = await fetch(`/api/canvas/pages/${encodeURIComponent(j.page.id)}`);
            const fj = await full.json().catch(() => null);
            if (full.ok && fj?.page) {
              applyPage(fj.page, fj.pages ?? []);
            } else {
              applyPage(j.page, j.pages ?? []);
            }
            setPhase("ready");
            return;
          }
          // Not a known project — fall through to page-id attempt.
        }

        const res = await fetch(`/api/canvas/pages/${encodeURIComponent(canvasId)}`);
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.page) {
          if (!cancelled) {
            setError(j?.error?.message ?? "Canvas not found.");
            setPhase("error");
          }
          return;
        }
        if (cancelled) return;
        setProject({ id: j.page.project_id, course_id: null, title: "Canvas" });
        applyPage(j.page, j.pages ?? []);
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setError("Failed to load canvas.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasId, queryCourseId, router, applyPage]);

// Debounced real save. A monotonic revision guards against a slow earlier
// request landing after a newer one (stale overwrite protection).
const revRef = useRef(0);

useEffect(() => {
    if (phase !== "ready" || !pageId || skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaved("Saving");
    const rev = ++revRef.current;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/canvas/pages/${encodeURIComponent(pageId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            doc: { version: 1, elements: blocks.map((b) => ({ id: b.id, text: b.text })), strokes, shapes }
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          setSaveError(j?.error?.message ?? `Save failed (${res.status}).`);
        } else if (rev === revRef.current) {
          setSaveError(null);
          setSaved("Saved");
        }
      } catch {
        setSaveError("Save failed — connection lost. Edits remain locally.");
        setSaved("Saved");
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [blocks, strokes, shapes, title, pageId, phase]);

  const addStroke = (s: Stroke) => {
    setStrokePast((p) => [...p.slice(-19), strokes]);
    setStrokeFuture([]);
    setStrokes((v) => [...v, s]);
  };
  const replaceStrokes = (next: Stroke[]) => {
    setStrokePast((p) => [...p.slice(-19), strokes]);
    setStrokeFuture([]);
    setStrokes(next);
  };
  const setShapesList = (next: Shape[]) => {
    setStrokePast((p) => [...p.slice(-19), strokes]);
    setStrokeFuture([]);
    setShapes(next);
  };
  const undoStroke = () => {
    if (!strokePast.length) return;
    const prev = strokePast[strokePast.length - 1];
    setStrokeFuture((f) => [strokes, ...f].slice(0, 20));
    setStrokePast((p) => p.slice(0, -1));
    setStrokes(prev);
  };
  const redoStroke = () => {
    if (!strokeFuture.length) return;
    setStrokePast((p) => [...p, strokes]);
    setStrokes(strokeFuture[0]);
    setStrokeFuture((f) => f.slice(1));
  };

  const setNext = (next: Block[]) => {
    setPast((p) => [...p.slice(-9), blocks]);
    setFuture([]);
    setBlocks(next);
  };
  const undo = () => {
    if (past.length) {
      setFuture((f) => [blocks, ...f]);
      setBlocks(past[past.length - 1]);
      setPast((p) => p.slice(0, -1));
    } else {
      undoStroke();
    }
  };
  const redo = () => {
    if (future.length) {
      setPast((p) => [...p, blocks]);
      setBlocks(future[0]);
      setFuture((f) => f.slice(1));
    } else {
      redoStroke();
    }
  };

  const loadPage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/canvas/pages/${encodeURIComponent(id)}`);
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.page) {
        setSaveError(j?.error?.message ?? "Couldn't load page.");
        return;
      }
      if (project) {
        try {
          sessionStorage.setItem(`canvas-project-${project.id}`, j.page.id);
        } catch { /* ignore */ }
      }
      applyPage(j.page, j.pages ?? []);
    } catch {
      setSaveError("Couldn't load page.");
    }
  }, [applyPage, project]);

  const reorder = async (from: number, to: number) => {
    if (!project || from === to || to < 0 || to >= pages.length) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPages(next); // optimistic
    try {
      const res = await fetch(`/api/canvas/projects/${encodeURIComponent(project.id)}/reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: next.map((p) => p.id) }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(j?.error?.message ?? "Reorder failed.");
        const lr = await fetch(`/api/canvas/pages/${encodeURIComponent(pageId ?? "")}`);
        const lj = await lr.json().catch(() => null);
        if (lr.ok && lj?.pages) setPages(lj.pages);
        return;
      }
      if (j?.pages) setPages(j.pages);
      setSaveError(null);
    } catch {
      setSaveError("Reorder failed — connection lost.");
    }
  };

  const addPage = async () => {
    if (!project) return;
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, pageTitle: `Page ${pages.length + 1}` }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.page) {
        setSaveError(j?.error?.message ?? "Couldn't add page.");
        return;
      }
      await loadPage(j.page.id);
    } catch {
      setSaveError("Couldn't add page.");
    }
  };

  const deletePage = async () => {
    if (!pageId || pages.length <= 1) return;
    try {
      const res = await fetch(`/api/canvas/pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setSaveError(j?.error?.message ?? "Couldn't delete page.");
        return;
      }
      const remaining = pages.filter((p) => p.id !== pageId);
      if (remaining[0]) await loadPage(remaining[0].id);
    } catch {
      setSaveError("Couldn't delete page.");
    }
  };

  const duplicatePage = async () => {
    if (!project || !pageId) return;
    const copy = blocks.map((b) => ({ ...b }));
    const strokeCopy = strokes.map((s) => ({ ...s, id: uid(), points: s.points.map((p) => [...p] as [number, number]) }));
    const shapeCopy = shapes.map((s) => ({ ...s, id: uid() }));
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, pageTitle: `${title} (copy)` }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.page) {
        setSaveError(j?.error?.message ?? "Couldn't duplicate page.");
        return;
      }
      await fetch(`/api/canvas/pages/${encodeURIComponent(j.page.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc: { version: 1, elements: copy.map((b) => ({ id: uid(), text: b.text })), strokes: strokeCopy, shapes: shapeCopy } }),
      });
      await loadPage(j.page.id);
    } catch {
      setSaveError("Couldn't duplicate page.");
    }
  };

  const scopeKey: Record<Ctx, string> = { Selection: "selection", Page: "page", Project: "project", Course: "course" };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || aiLoading) return;
    if (!project) return;
    if (ctx === "Selection" && !selection.trim()) {
      setAiView("insufficient");
      setAiMessage("Select some text in a block first (or pick another scope).");
      setAiAnswer(null);
      setAiCitations([]);
      return;
    }
    setAiLoading(true);
    setAiMessage(null);
    setRefineNote(null);
    try {
      const res = await fetch("/api/ai/canvas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: scopeKey[ctx],
          projectId: project.id,
          pageId,
          selection: selection.trim() || null,
          courseId: effectiveCourseId || null,
          question: text
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setAiView("insufficient");
        setAiMessage(j?.error?.message ?? "Ask failed.");
        setAiAnswer(null);
        setAiCitations([]);
        return;
      }
      setAiCitations(j.citations ?? []);
      if (j.grounded) {
        setAiView("answer");
        setAiAnswer(j.answer);
      } else {
        setAiView("insufficient");
        setAiMessage(j.message ?? "Not enough evidence in this scope.");
        setAiAnswer(j.answer ?? null);
      }
    } catch {
      setAiView("insufficient");
      setAiMessage("Ask failed. Check your connection and retry.");
      setAiAnswer(null);
      setAiCitations([]);
    } finally {
      setAiLoading(false);
    }
  };

  const refine = async (mode: RefineMode) => {
    const target = selection.trim() || blocks.find((b) => b.id === selectionBlock)?.text || blocks[0]?.text || "";
    if (!target.trim() || refineBusy) return;
    setRefineBusy(true);
    setRefineNote(null);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, text: target, pageId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setRefineNote(j?.error?.message ?? "Refinement failed.");
        return;
      }
      setProposal(j);
      setAiView("review");
    } catch {
      setRefineNote("Refinement failed — connection lost.");
    } finally {
      setRefineBusy(false);
    }
  };

  const exportProject = async () => {
    if (!project) return;
    try {
      const res = await fetch(`/api/canvas/projects/${encodeURIComponent(project.id)}/export`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(j?.error?.message ?? "Export failed.");
        return;
      }
      setPrintAll(j.pages ?? []);
      // Let the export layout paint before opening the print dialog.
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintAll(null), 500);
      }, 250);
    } catch {
      setSaveError("Export failed.");
    }
  };

  const suggested = (label: string) => {
    if (label === "Summarize this page") ask("Summarize this page in a few clear bullet points.");
    else if (label === "Explain my selection") ask("Explain the selected text in plain language.");
    else if (label === "Summarize whole project") {
      setCtx("Project");
      ask("Summarize this whole canvas project: key concepts, definitions and relationships between pages.");
    } else ask("Give me 3 bullet takeaways from this page.");
  };

  const toolHints: Record<string, string> = {
  select: "Select — drag text blocks to reposition.",
  pen: "Pen — freehand ink.",
  highlighter: "Highlighter — translucent marker.",
  eraser: "Eraser — removes ink you brush over.",
  text: "Text — click a block to edit, or add a new one.",
  shapes: "Shape — drag to draw a rectangle.",
  arrow: "Arrow — drag to draw a connector.",
  lasso: "Lasso — drag a region to select ink, then press Delete."
};

  const activeIdx = pages.findIndex((p) => p.id === pageId);

  if (phase === "loading" || canvasId === "new") {
    return (
      <div className="grid min-h-[calc(100vh-49px)] place-items-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="py-10 text-center text-[13px] text-muted-foreground">
            {canvasId === "new" ? "Creating canvas…" : "Loading canvas…"}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="grid min-h-[calc(100vh-49px)] place-items-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle>Couldn&apos;t open canvas</CardTitle><CardDescription>{error ?? "Unknown error."}</CardDescription></CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" variant="outline" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
            {queryCourseId && <Button size="sm" asChild><Link href={`/courses/${queryCourseId}`}>Open course</Link></Button>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-49px)] flex-col">
      {/* Top toolbar */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setLeftOpen((v) => !v)} aria-label="Tools">
            <PanelLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-muted-foreground">
              <Link href="/dashboard" className="hover:underline">Canvas</Link> / {project?.title ?? canvasId}
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-40 bg-transparent text-[15px] font-semibold tracking-tight outline-none focus:border-b md:w-56"
                aria-label="Page title"
              />
              <Badge tone={saved === "Saved" && !saveError ? "success" : "warn"}>{saved}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={undo} disabled={!past.length && !strokePast.length} aria-label="Undo"><Undo2 /></Button>
            <Button size="sm" variant="ghost" onClick={redo} disabled={!future.length && !strokeFuture.length} aria-label="Redo"><Redo2 /></Button>
            <Button size="sm" variant="outline" onClick={exportProject}>
              Export project PDF
            </Button>
            <div className="relative">
              <Button size="sm" variant="ghost" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu"><MoreHorizontal /></Button>
              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-border bg-card p-1 shadow-lift">
                  <button onClick={() => { setMenuOpen(false); titleRef.current?.focus(); }} className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-muted">
                    Rename page
                  </button>
                  <button onClick={() => { setMenuOpen(false); duplicatePage(); }} className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-muted">
                    Duplicate page
                  </button>
                  <button onClick={() => { setMenuOpen(false); exportProject(); }} className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-muted">
                    Export project PDF
                  </button>
                  <button onClick={async () => {
                    setMenuOpen(false);
                    if (!project) return;
                    const name = window.prompt("Rename project", project.title);
                    if (!name?.trim()) return;
                    const res = await fetch(`/api/canvas/projects/${encodeURIComponent(project.id)}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ title: name.trim() })
                    });
                    const j = await res.json().catch(() => null);
                    if (res.ok && j?.project) setProject({ ...project, title: j.project.title });
                    else setSaveError(j?.error?.message ?? "Rename failed.");
                  }} className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-muted">
                    Rename project
                  </button>
                  <button onClick={async () => {
                    setMenuOpen(false);
                    if (!project) return;
                    if (!window.confirm("Delete this canvas and all its pages? This cannot be undone.")) return;
                    const res = await fetch(`/api/canvas/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
                    if (res.ok) router.push(effectiveCourseId ? `/courses/${effectiveCourseId}` : "/dashboard");
                    else setSaveError("Delete failed.");
                  }} className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-red-600 hover:bg-muted">
                    Delete project
                  </button>
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setRightOpen((v) => !v)} aria-label="AI panel">
              <PanelRight />
            </Button>
          </div>
        </div>
        {saveError && (
          <div className="flex items-center justify-between border-t border-border bg-muted px-3 py-1.5 text-[12.5px]">
            <span>{saveError}</span>
            <button onClick={() => setSaveError(null)} aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left tool rail */}
        <div className={cn("relative z-10 w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-card/60 py-3", leftOpen ? "flex" : "hidden", "md:flex")}>
          {tools.map((t) => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => { setTool(t.id); setStyleOpen(t.id === "pen" || t.id === "highlighter" || t.id === "text"); }}
              className={cn("grid size-9 place-items-center rounded-xl transition", tool === t.id ? "bg-foreground text-background" : "text-foreground/60 hover:bg-muted hover:text-foreground")}
            >
              <t.icon className="size-4" />
            </button>
          ))}
          <AnimatePresence>
            {styleOpen && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="absolute left-14 top-10 w-40 rounded-xl border border-border bg-card p-3 shadow-lift">
                <p className="text-[11px] font-medium text-muted-foreground">Color</p>
                <div className="mt-1.5 flex gap-1.5">
                  {colors.map((c) => (
                    <button key={c} onClick={() => setColor(c)} aria-label={c} className={cn("size-5 rounded-full border", color === c && "ring-2 ring-foreground ring-offset-2")} style={{ background: c }} />
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">Thickness · {thick}px</p>
                <input type="range" min={1} max={8} value={thick} onChange={(e) => setThick(Number(e.target.value))} className="mt-1 w-full" aria-label="Thickness" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="paper-grid relative flex-1 overflow-auto p-4 md:p-8">
            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border bg-card/95 px-3 py-1 text-[11.5px] text-muted-foreground shadow-soft backdrop-blur">
              {toolHints[tool]}
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
              <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out"><ZoomOut /></Button>
              <span className="w-12 text-center text-xs font-medium">{zoom}%</span>
              <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Zoom in"><ZoomIn /></Button>
            </div>
            <div className="mx-auto max-w-3xl" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
              <div className="relative min-h-[560px] rounded-2xl border border-border bg-card/40 shadow-soft">
                <InkLayer
                  strokes={strokes}
                  shapes={shapes}
                  onStroke={addStroke}
                  onStrokes={replaceStrokes}
                  onShapes={setShapesList}
                  onCommit={() => {}}
                  tool={tool}
                  color={color}
                  width={thick}
                  zoom={zoom}
                  interactive={tool === "pen" || tool === "highlighter" || tool === "eraser" || tool === "shapes" || tool === "arrow" || tool === "lasso"}
                  selection={inkSel}
                  onSelectionChange={setInkSel}
                  className="z-0"
                />
                <div className="pointer-events-none relative z-10 p-6">
                  {blocks.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border bg-card/70 p-6 text-center text-[13px] text-muted-foreground">
                      {tool === "pen" || tool === "highlighter" ? "Draw anywhere on this page." : "Empty page — use Text to add a note, or Pen to draw."}
                    </p>
                  )}
                  <div className="space-y-3">
                    {blocks.map((b) => (
                      <motion.div key={b.id} drag={tool === "select"} dragMomentum={false} className="pointer-events-auto group w-[min(520px,100%)] rounded-xl border border-border bg-card/95 p-3 shadow-soft" style={{ borderLeftColor: color, borderLeftWidth: thick + 1 }}>
                        <textarea
                          value={b.text}
                          onChange={(e) => setNext(blocks.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                          onSelect={(e) => {
                            const el = e.currentTarget;
                            const sel = el.value.slice(el.selectionStart, el.selectionEnd).trim();
                            if (sel) {
                              setSelection(sel);
                              setSelectionBlock(b.id);
                              setCtx("Selection");
                            }
                          }}
                          rows={2}
                          placeholder="Write a note…"
                          className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
                          aria-label="Editable block"
                        />
                        <div className="flex gap-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <Button size="sm" variant="ghost" onClick={() => setNext(blocks.filter((x) => x.id !== b.id))}>Delete</Button>
                          <Button size="sm" variant="ghost" onClick={() => setNext([...blocks, { id: uid(), text: b.text }])}>Duplicate</Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  {tool === "select" && (
                    <div className="pointer-events-auto mt-3">
                      <Button size="sm" variant="outline" onClick={() => setNext([...blocks, { id: uid(), text: "" }])}><Plus /> Add text block</Button>
                    </div>
                  )}
                </div>
              </div>
              {tool === "lasso" && inkSel.length > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12.5px]">
                  <span>{inkSel.length} item{inkSel.length === 1 ? "" : "s"} selected</span>
                  <Button size="sm" variant="outline" onClick={() => setInkSel([])}>Clear</Button>
                  <span className="text-muted-foreground">Press Delete/Backspace to remove</span>
                </div>
              )}
            </div>
          </div>

          {/* Page navigator */}
          <div className="border-t border-border bg-card/60">
            <button onClick={() => setPagesOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-1.5 text-[12.5px] font-medium">
              <span>{pages[activeIdx]?.title ?? "Pages"} · {pages.length} pages</span>
              <ChevronDown className={cn("size-4 transition", !pagesOpen && "-rotate-90")} />
            </button>
            {pagesOpen && (
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 pb-2.5">
                {pages.map((p, i) => (
                  <button key={p.id} onClick={() => loadPage(p.id)} title={p.title} className={cn("grid h-14 w-11 shrink-0 place-items-center rounded-lg border text-[10.5px]", pageId === p.id ? "border-foreground bg-foreground text-background" : "border-border bg-muted")}>
                    {i + 1}
                  </button>
                ))}
                <Button size="sm" variant="outline" onClick={addPage} aria-label="Add page"><Plus /></Button>
                <Button size="sm" variant="ghost" onClick={() => titleRef.current?.focus()}>Rename</Button>
                <Button size="sm" variant="ghost" onClick={duplicatePage}>Duplicate</Button>
                <Button size="sm" variant="ghost" disabled={activeIdx <= 0} onClick={() => reorder(activeIdx, activeIdx - 1)} aria-label="Move page left">←</Button>
                <Button size="sm" variant="ghost" disabled={activeIdx < 0 || activeIdx >= pages.length - 1} onClick={() => reorder(activeIdx, activeIdx + 1)} aria-label="Move page right">→</Button>
                <Button size="sm" variant="ghost" onClick={deletePage} disabled={pages.length <= 1}>Delete</Button>
              </div>
            )}
          </div>
        </div>

        {/* Right AI panel */}
        <div className={cn("w-[300px] shrink-0 flex-col border-l border-border bg-card/60", rightOpen ? "flex" : "hidden", "lg:flex")}>
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Sparkles className="size-4" /> AI</span>
            <button className="lg:hidden" onClick={() => setRightOpen(false)} aria-label="Close AI"><X className="size-4" /></button>
          </div>

          {aiView === "insufficient" ? (
            <div className="flex-1 space-y-3 overflow-auto p-3">
              <Card>
                <CardHeader><CardTitle>Not enough in sources</CardTitle><CardDescription>Calm note — no guess made.</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-[13px] text-foreground/75">
                  <p>{aiMessage ?? "No direct match for this question in your course sources."}</p>
                  {aiAnswer && <p className="whitespace-pre-wrap">{aiAnswer}</p>}
                  {aiCitations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {aiCitations.map((c) => (
                        <SourceChip key={c.n} label={c.page_no != null ? `${c.filename} p.${c.page_no}` : c.filename} />
                      ))}
                    </div>
                  )}
                  <Button size="sm" className="w-full" onClick={() => { setCtx("Course"); setAiView("idle"); setAiMessage(null); }}>Broaden scope to Course</Button>
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => setAiView("idle")}>Return</Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap gap-1 p-3">
                {(["Selection", "Page", "Project", "Course"] as Ctx[]).map((c) => (
                  <button key={c} onClick={() => setCtx(c)} className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-medium", ctx === c ? "bg-foreground text-background" : "bg-muted text-foreground/70")}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="no-scrollbar flex flex-wrap gap-1 border-b border-border px-3 pb-2">
                {REFINE_MODES.map((m) => (
                  <button key={m} onClick={() => refine(m)} disabled={refineBusy} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] font-medium text-foreground/75 hover:bg-muted disabled:opacity-50">
                    {REFINE_LABELS[m]}
                  </button>
                ))}
              </div>
              {refineNote && <p className="px-3 pt-2 text-[12px] text-amber-700">{refineNote}</p>}
              <div className="flex-1 space-y-2 overflow-auto px-3">
                {aiView === "idle" && (
                  <div className="space-y-1.5">
                    <p className="text-[12px] text-muted-foreground">Suggested:</p>
                    {["Summarize this page", "Explain my selection", "Summarize whole project", "3 bullet takeaways"].map((s) => (
                      <button key={s} onClick={() => suggested(s)} disabled={aiLoading} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-[13px] hover:bg-muted disabled:opacity-50">
                        {s}
                      </button>
                    ))}
                    {ctx === "Selection" && !selection && <p className="text-[11.5px] text-muted-foreground">Tip: select text inside a block to enable Selection scope.</p>}
                    {aiLoading && <p className="text-[12px] text-muted-foreground">Thinking…</p>}
                  </div>
                )}
                {aiView !== "idle" && aiView !== "review" && aiAnswer && (
                  <Card>
                    <CardContent className="space-y-2 pt-4 text-[13px] leading-relaxed text-foreground/80">
                      <p className="whitespace-pre-wrap">{aiAnswer}</p>
                      <p className="text-[11.5px] text-muted-foreground">Scope: {ctx} · {ctx === "Course" ? "answered from your course sources." : "answered from your canvas notes."}</p>
                      {aiCitations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {aiCitations.map((c) => (
                            <SourceChip key={c.n} label={c.page_no != null ? `${c.filename} p.${c.page_no}` : c.filename} />
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setNext([...blocks, { id: uid(), text: aiAnswer }])}><Plus /> Insert</Button>
                        <Button size="sm" onClick={() => setAiView("review")}><Copy /> Replace</Button>
                      </div>
                      <button onClick={() => setAiView("insufficient")} className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                        <Info className="size-3.5" /> insufficient-info demo
                      </button>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="flex gap-1.5 border-t border-border p-3">
                <Input value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Ask AI…" onKeyDown={(e) => { if (e.key === "Enter") { ask(chat); setChat(""); } }} />
                <Button size="sm" disabled={aiLoading} onClick={() => { ask(chat); setChat(""); }}>Send</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review modal — AI replacement and AI refinement proposals */}
      <AnimatePresence>
        {aiView === "review" && (aiAnswer || proposal) && (() => {
          const proposed = proposal?.refined ?? aiAnswer ?? "";
          const originalText = selection.trim() || blocks.find((b) => b.id === selectionBlock)?.text || blocks[0]?.text || "—";
          const targetId = selectionBlock ?? blocks[0]?.id ?? null;
          return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
            <motion.div initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: 0.98 }} className="w-full max-w-lg">
              <Card>
                <CardHeader>
                  <CardTitle>Review change</CardTitle>
                  <CardDescription>{proposal ? proposal.note : "Original vs proposed."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted p-3 text-[13px]">
                      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">ORIGINAL</p>
                      {originalText}
                    </div>
                    <div className="max-h-40 overflow-auto rounded-xl border border-foreground/30 bg-card p-3 text-[13px]">
                      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">PROPOSED</p>
                      <span className="whitespace-pre-wrap">{proposed}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => {
                      if (targetId) setNext(blocks.map((b) => (b.id === targetId ? { ...b, text: proposed } : b)));
                      setProposal(null); setAiView("idle"); setRefineNote(null);
                    }}><Check /> Accept / Replace</Button>
                    <Button size="sm" variant="outline" onClick={() => { setNext([...blocks, { id: uid(), text: proposed }]); setProposal(null); setAiView("idle"); setRefineNote(null); }}>Insert as new</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setProposal(null); setAiView("idle"); setRefineNote(null); }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Whole-project print layout (only mounted during export) */}
      {printAll && (
        <div className="print-only fixed inset-0 z-[60] overflow-auto bg-white p-0">
          {printAll.map((p, i) => {
            const doc = coerceDoc(p.doc);
            return (
              <div key={p.id} className="print-page mx-auto mb-6 w-[720px] min-h-[900px] border border-border bg-white p-10 text-black">
                <h1 className="mb-1 text-xl font-semibold">{p.title}</h1>
                <p className="mb-5 text-[11px] uppercase tracking-wide text-neutral-500">Page {i + 1} of {printAll.length}</p>
                {doc.elements.filter((e) => e.text.trim()).map((e) => (
                  <p key={e.id} className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed">{e.text}</p>
                ))}
                <svg className="mt-4 w-full" viewBox="0 0 640 240" style={{ maxHeight: 240 }}>
                  {(doc.shapes ?? []).map((s) => (
                    <g key={s.id} stroke={s.color} strokeWidth={Math.max(0.6, s.strokeWidth * 0.8)} fill={s.kind === "arrow" ? "none" : `${s.color}14`}>
                      {s.kind === "rect" && <rect x={s.x} y={s.y} width={s.w} height={s.h} />}
                      {s.kind === "circle" && <ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={Math.abs(s.w / 2)} ry={Math.abs(s.h / 2)} />}
                      {s.kind === "arrow" && (
                        <>
                          <line x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} />
                          <polyline
                            points={`${s.x + s.w},${s.y + s.h} ${s.x + s.w - 14 * Math.cos(Math.atan2(s.h, s.w) - 0.4)},${s.y + s.h - 14 * Math.sin(Math.atan2(s.h, s.w) - 0.4)} ${s.x + s.w - 14 * Math.cos(Math.atan2(s.h, s.w) + 0.4)},${s.y + s.h - 14 * Math.sin(Math.atan2(s.h, s.w) + 0.4)}`}
                            fill="none"
                          />
                        </>
                      )}
                    </g>
                  ))}
                  {(doc.strokes ?? []).filter((s) => s.tool !== "eraser").map((s) => (
                    <polyline
                      key={s.id}
                      points={s.points.map((pt) => `${pt[0]},${pt[1]}`).join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={Math.max(0.6, s.width * 0.8)}
                      strokeOpacity={s.opacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CanvasPage({ params }: { params: { canvasId: string } }) {
  return (
    <Suspense>
      <CanvasInner canvasId={params.canvasId} />
    </Suspense>
  );
}
