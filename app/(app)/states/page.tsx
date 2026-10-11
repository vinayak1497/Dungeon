"use client";
import { useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowRight, Trash2, Inbox, Loader2, TriangleAlert, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, Progress } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-[13px]">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

export default function StatesPage() {
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <div>
      <Topbar title="System states" crumbs={["Workspace", "States"]} actions={<Button size="sm" variant="outline" asChild><Link href="/dashboard">Dashboard <ArrowRight /></Link></Button>} />
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-6 md:px-8">
        <Rise>
          <p className="text-[13px] text-muted-foreground">Gallery · Screen 28 · consistent badges + recovery actions.</p>
        </Rise>
        <Stagger className="grid gap-3 md:grid-cols-2">
          <Item><Row title="Empty — dashboard / course / module / canvas">
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Inbox className="size-4" /> Nothing here yet.</p>
            <Button size="sm" variant="outline" asChild><Link href="/courses/new">Create first item</Link></Button>
          </Row></Item>
          <Item><Row title="Upload progress">
            <Progress value={62} /><p className="text-[12px] text-muted-foreground">notes-03.pdf · 62%</p>
          </Row></Item>
          <Item><Row title="Processing">
            <p className="flex items-center gap-2 text-[13px]"><Loader2 className="size-4 animate-spin" /> Extracting concepts… <Badge>processing</Badge></p>
          </Row></Item>
          <Item><Row title="Failed + retry / Partial">
            <p className="flex items-center gap-2 text-[13px]"><TriangleAlert className="size-4 text-amber-600" /> 1 file failed. <Badge tone="warn">failed</Badge></p>
            <p className="text-[12.5px] text-muted-foreground">Partial: 3 of 4 ready. <Badge>partial</Badge></p>
            <span className="flex gap-2"><Button size="sm" variant="outline"><RefreshCw /> Retry</Button><Button size="sm" variant="ghost" asChild><Link href="/manage">Review</Link></Button></span>
          </Row></Item>
          <Item><Row title="Save failure">
            <p className="text-[13px] text-muted-foreground">Couldn&apos;t save. Check connection.</p>
            <Button size="sm" variant="outline"><RefreshCw /> Retry save</Button>
          </Row></Item>
          <Item><Row title="AI generating / failed">
            <p className="flex items-center gap-2 text-[13px]"><Loader2 className="size-4 animate-spin" /> Drafting quiz… <Badge tone="accent">generating</Badge></p>
            <p className="flex items-center gap-2 text-[13px]"><TriangleAlert className="size-4 text-amber-600" /> Generation failed. <Badge tone="warn">AI failed</Badge> <Button size="sm" variant="outline"><RefreshCw /> Regenerate</Button></p>
          </Row></Item>
          <Item><Row title="No videos / quizzes">
            <p className="text-[13px] text-muted-foreground">No videos for this concept. <Badge>empty</Badge></p>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" asChild><Link href="/videos">Videos</Link></Button>
              <Button size="sm" variant="outline" asChild><Link href="/quiz/setup">New quiz</Link></Button>
            </span>
          </Row></Item>
          <Item><Row title="Export success / Delete confirm">
            <p className="flex items-center gap-2 text-[13px] text-emerald-700"><Check className="size-4" /> Export ready. <Badge tone="success">success</Badge></p>
            {!confirm && !deleted && <Button size="sm" variant="outline" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>}
            {confirm && !deleted && (
              <span className="flex items-center gap-2 text-[13px]">
                <Badge tone="warn">Confirm?</Badge>
                <button onClick={() => { setDeleted(true); setConfirm(false); }} className="font-semibold text-red-600">Delete</button>
                <button onClick={() => setConfirm(false)} className="text-muted-foreground">Keep</button>
              </span>
            )}
            {deleted && <p className="text-[13px] text-muted-foreground">Deleted (demo). <button onClick={() => setDeleted(false)} className="underline">Undo</button></p>}
          </Row></Item>
        </Stagger>
        <Card>
          <CardHeader><CardTitle>Badge key</CardTitle><CardDescription>Single language across screens</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>empty</Badge><Badge>processing</Badge><Badge tone="warn">failed</Badge><Badge>partial</Badge><Badge tone="accent">generating</Badge><Badge tone="warn">AI failed</Badge><Badge tone="success">success</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
