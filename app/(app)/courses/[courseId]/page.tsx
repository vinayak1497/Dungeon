"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Play, CalendarClock, ArrowRight, PenSquare, RotateCcw, Check, Lock, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";

type Structure = {
  course: { id: string; title: string; code: string | null; semester: string | null; exam_date: string | null; syllabus_status: string | null };
  modules: { id: string; title: string; position: number; status: string }[];
  concepts: { id: string; module_id: string; title: string; status: string }[];
  resources: { id: string; filename: string; kind: string | null; scope: string | null; status: string | null }[];
  assignments: { resource_id: string; module_id: string; state: string }[];
};

const toneFor = (s: string) => (s === "done" ? "success" : s === "active" ? "accent" : "neutral") as "success" | "accent" | "neutral";

function examLabel(examDate: string | null): string | null {
  if (!examDate) return null;
  const ms = new Date(examDate).getTime() - Date.now();
  if (Number.isNaN(new Date(examDate).getTime())) return null;
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return "Exam passed";
  if (days === 0) return "Exam today";
  return `Exam in ${days}d`;
}

export default function CoursePage({ params }: { params: { courseId: string } }) {
  const { courseId } = params;
  const [data, setData] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/courses/${courseId}/structure`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.status === 401) {
        setError("Sign in required.");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error?.message ?? "Failed to load course.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/syllabus/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error?.message ?? "Analysis failed.");
        return;
      }
      await load();
    } catch {
      setError("Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Topbar title="Loading…" crumbs={["Courses", courseId]} />
        <div className="mx-auto max-w-5xl px-5 py-6 md:px-8">
          <Card>
            <CardContent className="py-10 text-center text-[13px] text-muted-foreground">Loading course…</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <Topbar title="Not found" crumbs={["Courses", courseId]} />
        <div className="mx-auto max-w-5xl space-y-3 px-5 py-6 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Course not found</CardTitle>
              <CardDescription>No course with this id.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Topbar title="Error" crumbs={["Courses", courseId]} />
        <div className="mx-auto max-w-5xl space-y-3 px-5 py-6 md:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Couldn&apos;t load course</CardTitle>
              <CardDescription>{error ?? "Unknown error."}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" onClick={load}>
                Retry
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard">Back</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { course, modules, concepts, resources } = data;
  const done = modules.filter((m) => m.status === "done").length;
  const progress = modules.length === 0 ? 0 : Math.round((done / modules.length) * 100);
  const next = modules.find((m) => m.status !== "done") ?? modules[0] ?? null;
  const exam = examLabel(course.exam_date);
  const conceptCount = (mid: string) => concepts.filter((c) => c.module_id === mid).length;

  return (
    <div>
      <Topbar
        title={course.title}
        crumbs={["Courses", course.code ?? courseId]}
        actions={
          next ? (
            <Button size="sm" asChild>
              <Link href={`/courses/${courseId}/modules/${next.id}`}>
                <Play /> Continue
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-6 md:px-8">
        <Rise className="flex flex-wrap items-center gap-2">
          {exam && (
            <Badge tone="warn">
              <CalendarClock className="size-3" /> {exam}
            </Badge>
          )}
          {course.code && <Badge>{course.code}</Badge>}
          {course.syllabus_status && <Badge tone="accent">{course.syllabus_status}</Badge>}
          <Badge tone="accent">
            <Play className="size-3" /> {progress}% done
          </Badge>
        </Rise>

        <Rise>
          <Card>
            <CardHeader>
              <CardTitle>Coverage overview</CardTitle>
              <CardDescription>
                {done}/{modules.length} modules · {resources.length} resources{next ? ` · Next: ${next.title}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} />
              <div className="mt-3 flex flex-wrap gap-2">
                {next && (
                  <Button size="sm" asChild>
                    <Link href={`/courses/${courseId}/modules/${next.id}`}>
                      Next action <ArrowRight />
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/canvas/new?courseId=${courseId}`}>
                    <PenSquare /> Canvas
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/quiz/setup?courseId=${courseId}`}>
                    <Play /> Start quiz
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/revision?courseId=${courseId}`}>
                    <RotateCcw /> Revision
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Rise>

        {modules.length === 0 ? (
          <Rise>
            <Card>
              <CardHeader>
                <CardTitle>No modules yet</CardTitle>
                <CardDescription>Analyze the syllabus to build modules.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" onClick={analyze} disabled={analyzing}>
                  <FlaskConical /> {analyzing ? "Analyzing…" : "Analyze syllabus"}
                </Button>
              </CardContent>
            </Card>
          </Rise>
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <Item key={m.id}>
                <Link href={`/courses/${courseId}/modules/${m.id}`}>
                  <Card className="card-hover h-full">
                    <CardHeader>
                      <Badge tone={toneFor(m.status)}>
                        {m.status === "done" ? <Check className="size-3" /> : m.status === "locked" ? <Lock className="size-3" /> : <Play className="size-3" />}
                        {m.status}
                      </Badge>
                      <CardTitle>{m.title}</CardTitle>
                      <CardDescription>{conceptCount(m.id)} concepts</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </Item>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
