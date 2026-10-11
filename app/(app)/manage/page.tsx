"use client";
import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Repeat, Trash2, Save, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";
import { Input, Label } from "@/components/ui/input";
import { demo } from "@/lib/demo";

const resources = [
  { name: "Lecture notes 03.pdf", type: "PDF", mod: "Module 03", status: "ready" },
  { name: "Slides week 4.pptx", type: "Slides", mod: "Module 03", status: "processing" },
  { name: "Scan ch.5 (low quality)", type: "PDF", mod: "Module 02", status: "failed" },
  { name: "Problem set 2.pdf", type: "PDF", mod: "Module 02", status: "partial" },
];

export default function ManagePage() {
  const [del, setDel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <Topbar title="Manage course" crumbs={["Courses", "Course Alpha", "Manage"]} actions={<Button size="sm" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}><Save /> Save</Button>} />
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-6 md:px-8">
        {saved && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">Saved (demo).</p>}
        <Rise>
          <Card>
            <CardHeader><CardTitle>Course</CardTitle><CardDescription>Rename + metadata (demo)</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Title</Label><Input defaultValue="Course Alpha" /></div>
              <div><Label>Code</Label><Input defaultValue="CS-301" /></div>
            </CardContent>
          </Card>
        </Rise>
        <Stagger className="space-y-4">
          <Item>
            <Card>
              <CardHeader><CardTitle>Resources</CardTitle><CardDescription>Name · type · module · status</CardDescription></CardHeader>
              <CardContent className="space-y-1.5">
                {resources.map((r) => (
                  <div key={r.name} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <Badge>{r.type}</Badge>
                    <Badge>{r.mod}</Badge>
                    <Badge tone={r.status === "ready" ? "success" : r.status === "failed" ? "warn" : "neutral"}>{r.status}</Badge>
                    <span className="flex gap-1">
                      {r.status === "failed" ? (
                        <Button size="sm" variant="ghost"><RefreshCw /> Retry</Button>
                      ) : (
                        <Button size="sm" variant="ghost"><Repeat /> Replace</Button>
                      )}
                      {del === r.name ? (
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <button className="font-semibold text-red-600">Remove</button>
                          <button onClick={() => setDel(null)} className="text-muted-foreground">Keep</button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setDel(r.name)}><Trash2 /></Button>
                      )}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Item>
          <Item>
            <Card>
              <CardHeader><CardTitle>Modules</CardTitle><CardDescription>Rename + reorder (demo)</CardDescription></CardHeader>
              <CardContent className="space-y-1.5">
                {demo.modules.slice(0, 4).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                    <Input defaultValue={m.title} className="h-9" />
                    <Badge>{m.status}</Badge>
                  </div>
                ))}
                <Link href="/dashboard" className="text-[12.5px] text-muted-foreground hover:text-foreground">Back to dashboard</Link>
              </CardContent>
            </Card>
          </Item>
        </Stagger>
      </div>
    </div>
  );
}
