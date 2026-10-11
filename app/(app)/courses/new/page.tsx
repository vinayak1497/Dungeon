"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, UploadCloud, FileText, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise } from "@/components/motion";
import { useUploads } from "@/hooks/use-uploads";
import { formatBytes } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export default function NewCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", code: "", semester: "", dept: "", exam_date: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staged = useUploads("syllabus", "pending");
  const stagedFile = staged.files[0] ?? null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function cont() {
    if (!form.title.trim() || saving) return;
    if (!stagedFile) {
      setError("Syllabus is required — upload it above to create the course.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, exam_date: form.exam_date || null, syllabusPath: stagedFile?.path ?? null })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Create failed.");
      router.push(`/courses/new/resources?courseId=${json.course.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Topbar title="New course" crumbs={["Courses", "New"]} />
      <div className="mx-auto max-w-xl px-5 py-6">
        <Rise>
          <div className="flex items-center justify-between"><Badge>Step 1 / 3</Badge><span className="text-xs text-muted-foreground">Details + syllabus</span></div>
          <Progress value={25} className="mt-2" />
          <Card className="mt-4">
            <CardHeader><CardTitle>Course details</CardTitle><CardDescription>Minimal info to start. Attach the syllabus now or on the next step.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="cn">Course name</Label><Input id="cn" placeholder="Course Alpha" value={form.title} onChange={set("title")} /></div>
              <div><Label htmlFor="cc">Code</Label><Input id="cc" placeholder="CS-301" value={form.code} onChange={set("code")} /></div>
              <div><Label htmlFor="sem">Semester</Label><Input id="sem" placeholder="Sem 5" value={form.semester} onChange={set("semester")} /></div>
              <div><Label htmlFor="dept">Department</Label><Input id="dept" placeholder="Dept" value={form.dept} onChange={set("dept")} /></div>
              <div><Label htmlFor="exam">Exam date</Label><Input id="exam" type="date" value={form.exam_date} onChange={set("exam_date")} /></div>
              <div className="sm:col-span-2"><Label htmlFor="desc">Description</Label><Textarea id="desc" placeholder="Short summary…" value={form.description} onChange={set("description")} /></div>

              <div className="sm:col-span-2">
                <Label>Syllabus (required)</Label>
                <button
                  type="button"
                  onClick={() => document.getElementById("new-course-syllabus")?.click()}
                  onDragOver={(e) => { e.preventDefault(); staged.setDragOver(true); }}
                  onDragLeave={() => staged.setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); staged.setDragOver(false); if (e.dataTransfer.files.length) staged.uploadMany([e.dataTransfer.files[0]]); }}
                  className={cn("mt-1.5 grid w-full place-items-center rounded-2xl border border-dashed bg-muted/50 px-4 py-5 text-center transition", staged.dragOver ? "border-foreground/50 bg-muted" : "border-border")}
                >
                  <UploadCloud className="size-5 text-muted-foreground" />
                  <p className="mt-1 text-[13px] font-medium">{staged.busy ? "Uploading…" : "Drop syllabus or browse"}</p>
                  <p className="text-[11px] text-muted-foreground">PDF · DOC · parsed into modules after creation</p>
                </button>
                <input
                  id="new-course-syllabus"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.md"
                  onChange={(e) => { if (e.target.files?.length) staged.uploadMany([e.target.files[0]]); e.target.value = ""; }}
                />
                {stagedFile && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-border p-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{stagedFile.name} · {formatBytes(stagedFile.size)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-3" /> Staged — will attach to this course</p>
                    </div>
                    <button aria-label="remove syllabus" className="text-muted-foreground hover:text-foreground" onClick={() => staged.remove(stagedFile.path)}><X className="size-4" /></button>
                  </div>
                )}
              </div>

              {error && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 sm:col-span-2">{error}</p>}
              <div className="flex items-center justify-between pt-1 sm:col-span-2">
                <Button variant="ghost" asChild><Link href="/dashboard"><ArrowLeft /> Cancel</Link></Button>
                <Button onClick={cont} disabled={!form.title.trim() || saving || staged.busy || !stagedFile}>
                  {saving ? <><Loader2 className="animate-spin" /> Creating…</> : <>Continue <ArrowRight /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </Rise>
      </div>
    </div>
  );
}
