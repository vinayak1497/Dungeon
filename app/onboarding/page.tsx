"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge, Progress } from "@/components/ui/meta";
import { Rise } from "@/components/motion";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ display_name: "", institution: "", degree: "", branch: "", semester: "", grad_year: "", portal_url: "", exam_date: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.profile) {
          setForm((f) => ({
            display_name: j.profile.display_name ?? f.display_name,
            institution: j.profile.institution ?? "",
            degree: j.profile.degree ?? "",
            branch: j.profile.branch ?? "",
            semester: j.profile.semester ?? "",
            grad_year: j.profile.grad_year ?? "",
            portal_url: j.profile.portal_url ?? "",
            exam_date: j.profile.exam_date ?? ""
          }));
        }
      })
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function cont() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed.");
      router.push("/onboarding/complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl bg-background px-5 py-10 text-foreground">
      <Rise>
        <div className="flex items-center justify-between">
          <Badge>Step 1 of 2</Badge>
          <Link href="/dashboard" className="text-[13px] text-muted-foreground hover:text-foreground">Skip</Link>
        </div>
        <Progress value={50} className="mt-3" />
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Personalize your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1"><Label htmlFor="n">Name</Label><Input id="n" placeholder="Student" value={form.display_name} onChange={set("display_name")} /></div>
            <div className="sm:col-span-1"><Label htmlFor="i">Institution</Label><Input id="i" placeholder="Institution" value={form.institution} onChange={set("institution")} /></div>
            <div><Label htmlFor="d">Degree</Label><Input id="d" placeholder="Degree" value={form.degree} onChange={set("degree")} /></div>
            <div><Label htmlFor="b">Branch</Label><Input id="b" placeholder="Branch" value={form.branch} onChange={set("branch")} /></div>
            <div><Label htmlFor="s">Semester</Label><Input id="s" placeholder="Sem 5" value={form.semester} onChange={set("semester")} /></div>
            <div><Label htmlFor="g">Grad year</Label><Input id="g" placeholder="2027" value={form.grad_year} onChange={set("grad_year")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="u">Portal URL</Label><Input id="u" placeholder="https://" value={form.portal_url} onChange={set("portal_url")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="e">Next exam date</Label><Input id="e" type="date" value={form.exam_date} onChange={set("exam_date")} /></div>
            {error && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 sm:col-span-2">{error}</p>}
            <div className="flex items-center justify-between pt-2 sm:col-span-2">
              <Button variant="ghost" asChild><Link href="/signup"><ArrowLeft /> Back</Link></Button>
              <Button onClick={cont} disabled={saving}>
                {saving ? <><Loader2 className="animate-spin" /> Saving…</> : <>Continue <ArrowRight /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Rise>
    </div>
  );
}
