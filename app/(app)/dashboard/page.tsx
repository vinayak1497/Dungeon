"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Play, CalendarClock, ArrowRight, Sparkles, BookOpen, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";
import type { Course } from "@/lib/database.types";

type CourseRow = Course & { modules?: number; resources?: number };

function daysUntil(date: string | null) {
  if (!date) return null;
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return d >= 0 ? d : null;
}

function DashboardInner() {
  const params = useSearchParams();
  const forceEmpty = params.get("demo") === "empty";
  const [courses, setCourses] = useState<CourseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? "Load failed.");
        setCourses(j.courses ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed."));
  }, []);

  const examCourse = (courses ?? []).find((c) => daysUntil(c.exam_date) !== null);
  const isEmpty = forceEmpty || (courses !== null && courses.length === 0);

  if (courses === null && !error) {
    return (
      <div>
        <Topbar title="Dashboard" crumbs={["Home"]} />
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8">
          <p className="animate-pulse rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div>
        <Topbar title="Dashboard" crumbs={["Home"]} />
        <div className="mx-auto max-w-lg px-5 py-16 text-center">
          <Rise>
            <div className="paper-grid mx-auto grid h-36 place-items-center rounded-2xl border border-border bg-card">
              <BookOpen className="size-8 text-muted-foreground" />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">No courses yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create your first course.</p>
            {error && <p className="mx-auto mt-3 flex max-w-sm items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"><AlertTriangle className="size-3.5" /> {error}</p>}
            <Button asChild className="mt-5"><Link href="/courses/new"><Plus /> Create first course</Link></Button>
          </Rise>
        </div>
      </div>
    );
  }

  const list = courses ?? [];

  return (
    <div>
      <Topbar
        title="Dashboard"
        crumbs={["Home"]}
        actions={<Button size="sm" asChild><Link href="/courses/new"><Plus /> Create course</Link></Button>}
      />
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-6 md:px-8">
        {error && <p className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700"><AlertTriangle className="size-3.5" /> {error}</p>}
        <Rise>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Good evening</h2>
              <p className="text-[13px] text-muted-foreground">Pick up where you left off.</p>
            </div>
          </div>
        </Rise>

        <Stagger className="grid gap-3 sm:grid-cols-2">
          {list.slice(0, 2).map((c) => (
            <Item key={c.id}>
              <Card className="card-hover">
                <CardHeader>
                  <Badge tone="accent"><Play className="size-3" /> Continue</Badge>
                  <CardTitle>{c.title}</CardTitle>
                  <CardDescription>{c.code ?? "Course"} · {c.modules ?? 0} modules · {c.resources ?? 0} files</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="sm" className="mt-1" asChild><Link href={`/courses/${c.id}`}>Resume <ArrowRight /></Link></Button>
                </CardContent>
              </Card>
            </Item>
          ))}
        </Stagger>

        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>My Courses</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {list.map((c) => (
                <Link key={c.id} href={`/courses/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-muted">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Sparkles className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{c.modules ?? 0} modules · {c.resources ?? 0} files</span>
                  </span>
                  {c.exam_date && daysUntil(c.exam_date) !== null && <Badge tone="warn">{daysUntil(c.exam_date)}d</Badge>}
                </Link>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-3">
            {examCourse && (
              <Card>
                <CardHeader><Badge tone="warn"><CalendarClock className="size-3" /> {daysUntil(examCourse.exam_date)}d left</Badge>
                <CardTitle>Exam soon</CardTitle><CardDescription>{examCourse.title}</CardDescription></CardHeader>
                <CardContent><Button size="sm" variant="outline" asChild><Link href="/revision">Revise now</Link></Button></CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle>Next step</CardTitle><CardDescription>Open a course to continue</CardDescription></CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" asChild><Link href={list[0] ? `/courses/${list[0].id}` : "/courses/new"}>Open</Link></Button>
                <Button size="sm" variant="outline" asChild><Link href="/revision"><RotateCcw /> Revision</Link></Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}
