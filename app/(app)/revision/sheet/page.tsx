"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Download, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, SourceChip } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";
import { Textarea } from "@/components/ui/input";

type SheetContent = {
  title?: string;
  keyPoints?: string[];
  definitions?: { term: string; meaning: string }[];
  comparisons?: string[];
  practice?: string[];
  weak?: string[];
  sources?: { filename: string; page_no: number | null }[];
};
type Sheet = { id: string; course_id: string | null; title: string; content: SheetContent; created_at: string };

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

function SheetInner() {
  const params = useSearchParams();
  const sheetId = params.get("sheetId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!sheetId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/revision/sheets/${encodeURIComponent(sheetId)}`);
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          setError(j?.error?.message ?? `Failed to load sheet (${res.status}).`);
          return;
        }
        setSheet(j.sheet);
      } catch {
        setError("Failed to load sheet.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sheetId]);

  const content: SheetContent = sheet?.content ?? {};
  const keyPoints = strList(content.keyPoints);
  const comparisons = strList(content.comparisons);
  const practice = strList(content.practice);
  const weak = strList(content.weak);
  const definitions = Array.isArray(content.definitions) ? content.definitions : [];
  const sources = Array.isArray(content.sources) ? content.sources : [];

  const markdown = useMemo(() => {
    if (!sheet) return "";
    const lines = [
      `# ${content.title ?? sheet.title}`,
      ``,
      `Generated ${new Date(sheet.created_at).toLocaleString()}`,
      ``,
      `## Key points`,
      ...keyPoints.map((k) => `- ${k}`),
      ``,
      `## Definitions`,
      ...definitions.map((d) => `- **${d.term}** — ${d.meaning}`),
      ``,
      `## Comparisons`,
      ...comparisons.map((c) => `- ${c}`),
      ``,
      `## Practice`,
      ...practice.map((p, i) => `${i + 1}. ${p}`),
      ``,
      `## Weak reminders (from real quiz misses)`,
      ...(weak.length ? weak.map((w) => `- ${w}`) : ["- None recorded."]),
      ``,
      `## Personal notes (local)`,
      notes || "(none)",
      ``,
      `## Sources`,
      ...sources.map((s) => `- ${s.filename}${s.page_no != null ? ` p.${s.page_no}` : ""}`),
    ];
    return lines.join("\n");
  }, [sheet, content.title, keyPoints, definitions, comparisons, practice, weak, sources, notes]);

  const exportMd = () => {
    if (!sheet) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(content.title ?? sheet.title).replace(/[^\w\- ]+/g, "").trim() || "revision-sheet"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!sheetId) {
    return (
      <div>
        <Topbar title="Revision sheet" crumbs={["Learn", "Revision", "Sheet"]} />
        <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
          <Card><CardContent className="space-y-3 p-6 text-center">
            <p className="text-[15px] font-semibold">No sheet selected</p>
            <p className="text-[13px] text-muted-foreground">Generate a sheet from the revision center first.</p>
            <Button size="sm" asChild><Link href="/revision">Open revision center</Link></Button>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <Topbar title="Revision sheet" crumbs={["Learn", "Revision", "Sheet"]} />
        <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
          <Card><CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading sheet…</CardContent></Card>
        </div>
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div>
        <Topbar title="Revision sheet" crumbs={["Learn", "Revision", "Sheet"]} />
        <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
          <Card><CardContent className="space-y-3 p-6 text-center">
            <p className="text-[15px] font-semibold">Couldn&apos;t load sheet</p>
            <p className="text-[13px] text-muted-foreground">{error ?? "Unknown error."}</p>
            <Button size="sm" variant="outline" asChild><Link href="/revision">Back to revision</Link></Button>
          </CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title="Revision sheet"
        crumbs={["Learn", "Revision", "Sheet"]}
        actions={
          <span className="flex gap-2">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
            ) : (
              <Button size="sm" onClick={() => setEditing(false)}>Done</Button>
            )}
            <Button size="sm" variant="outline" onClick={exportMd}><Download /> Export</Button>
            {sheet.course_id && (
              <Button size="sm" asChild><Link href={`/canvas/new?courseId=${encodeURIComponent(sheet.course_id)}`}><PenTool /> Open in Canvas</Link></Button>
            )}
          </span>
        }
      />
      <div className="mx-auto max-w-3xl px-5 py-6 md:px-8">
        <Rise>
          {editing && <p className="mb-3 rounded-xl bg-muted px-3 py-2 text-[13px] text-muted-foreground">Local edits, not saved — they only apply to this export.</p>}
          <Card>
            <CardContent className="space-y-5 p-6 md:p-8">
              <div>
                <Badge>Revision sheet</Badge>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{content.title ?? sheet.title}</h2>
                <p className="text-[13px] text-muted-foreground">Generated {new Date(sheet.created_at).toLocaleString()}</p>
                {sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sources.map((s, i) => (
                      <SourceChip key={i} label={s.page_no != null ? `${s.filename} p.${s.page_no}` : s.filename} />
                    ))}
                  </div>
                )}
              </div>
              <section>
                <h3 className="text-sm font-semibold">Key concepts</h3>
                {keyPoints.length === 0 ? (
                  <p className="mt-1.5 text-[13.5px] text-muted-foreground">No key points recorded.</p>
                ) : (
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13.5px] text-muted-foreground">
                    {keyPoints.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold">Definitions & formulas</h3>
                {definitions.length === 0 ? (
                  <p className="mt-1.5 text-[13.5px] text-muted-foreground">No definitions recorded.</p>
                ) : (
                  <div className="mt-1.5 space-y-1.5">
                    {definitions.map((d, i) => (
                      <p key={i} className="rounded-xl bg-muted p-3 text-[12.5px]"><span className="font-semibold">{d.term}</span> — {d.meaning}</p>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold">Comparison</h3>
                {comparisons.length === 0 ? (
                  <p className="mt-1.5 text-[13.5px] text-muted-foreground">No comparisons recorded.</p>
                ) : (
                  <div className="mt-1.5 grid gap-2 text-[13px] sm:grid-cols-2">
                    {comparisons.map((c, i) => (
                      <div key={i} className="rounded-xl border border-border p-3 text-muted-foreground">{c}</div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold">Weak reminders</h3>
                {weak.length === 0 ? (
                  <p className="mt-1 text-[13.5px] text-muted-foreground">No weak spots recorded — they appear after graded quizzes.</p>
                ) : (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-[13.5px] text-muted-foreground">
                    {weak.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                <h3 className="mt-4 text-sm font-semibold">Personal notes</h3>
                {editing ? (
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your own reminders…" className="mt-1.5" />
                ) : (
                  <p className="mt-1 text-[13.5px] text-muted-foreground">{notes || "No personal notes."}</p>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold">Self-test</h3>
                {practice.length === 0 ? (
                  <p className="mt-1.5 text-[13.5px] text-muted-foreground">No practice prompts recorded.</p>
                ) : (
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[13.5px] text-muted-foreground">
                    {practice.map((p, i) => <li key={i}>{p}</li>)}
                  </ol>
                )}
              </section>
            </CardContent>
          </Card>
        </Rise>
      </div>
    </div>
  );
}

export default function RevisionSheetPage() {
  return (
    <Suspense>
      <SheetInner />
    </Suspense>
  );
}
