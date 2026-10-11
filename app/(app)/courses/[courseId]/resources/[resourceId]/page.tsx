"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, PenSquare, Sparkles, ChevronDown, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, SourceChip } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";

const names: Record<string, string> = { r1: "Lecture-04.pdf", r2: "Slides-07.pdf", r3: "Notes-02.md" };
type AiMode = "Summarize" | "Explain" | "Create-notes";

export default function ResourcePage({ params }: { params: { courseId: string; resourceId: string } }) {
  const { courseId, resourceId } = params;
  const name = names[resourceId] ?? `Doc-${resourceId}.pdf`;
  const [page, setPage] = useState(4);
  const total = 12;
  const [zoom, setZoom] = useState(100);
  const [aiOpen, setAiOpen] = useState(true);
  const [mode, setMode] = useState<AiMode>("Summarize");

  return (
    <div>
      <Topbar
        title={name}
        crumbs={["Courses", courseId, resourceId]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="?download=1" scroll={false}>
                <Download /> Download
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/canvas/studio">
                <PenSquare /> Open in Canvas
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-4xl space-y-3 px-5 py-6 md:px-8">
        <Rise className="flex flex-wrap items-center gap-2">
          <Badge>PDF · {total} pages</Badge>
          <Badge>Module 03</Badge>
          <SourceChip label="p.12" />
        </Rise>

        <Rise>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Prev page">
                  <ChevronLeft />
                </Button>
                <span className="text-[13px] font-medium">
                  {page} / {total}
                </span>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(total, p + 1))} aria-label="Next page">
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out">
                  <ZoomOut />
                </Button>
                <span className="w-12 text-center text-[13px]">{zoom}%</span>
                <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Zoom in">
                  <ZoomIn />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="paper-grid grid min-h-[320px] place-items-center rounded-xl border border-border bg-background" style={{ fontSize: `${zoom / 100}rem` }}>
                <div className="m-6 w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-soft">
                  <FileText className="size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">{name}</p>
                  <p className="text-[13px] text-muted-foreground">Page {page} preview (demo)</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="h-2 rounded bg-muted" />
                    <div className="h-2 w-5/6 rounded bg-muted" />
                    <div className="h-2 w-2/3 rounded bg-muted" />
                  </div>
                </div>
              </div>
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {[3, 4, 5].map((t) => (
                  <button
                    key={t}
                    onClick={() => setPage(t)}
                    className={`grid h-16 w-12 shrink-0 place-items-center rounded-lg border text-[11px] font-medium ${page === t ? "border-foreground bg-foreground text-background" : "border-border bg-muted text-foreground/60"}`}
                  >
                    p.{t}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <button onClick={() => setAiOpen((v) => !v)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" /> AI · {mode} (demo)
              </span>
              {aiOpen ? <X className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <AnimatePresence initial={false}>
              {aiOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                  <CardContent className="space-y-3 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-2">
                      {(["Summarize", "Explain", "Create-notes"] as AiMode[]).map((m) => (
                        <Button key={m} size="sm" variant={mode === m ? "default" : "secondary"} onClick={() => setMode(m)}>
                          {m}
                        </Button>
                      ))}
                    </div>
                    <CardDescription>
                      {mode === "Summarize" && "Page summary: 3 bullets."} {mode === "Explain" && "Plain-language explainer."} {mode === "Create-notes" && "Note draft ready for Canvas."}{" "}
                      <SourceChip label={`${name} p.${page}`} />
                    </CardDescription>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Rise>
      </div>
    </div>
  );
}
