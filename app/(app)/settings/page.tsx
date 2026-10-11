"use client";
import { useState } from "react";
import { Save, Download, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/meta";
import { Topbar } from "@/components/shell";
import { Rise, Stagger, Item } from "@/components/motion";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [lang, setLang] = useState("English");
  const [pace, setPace] = useState("Standard");

  return (
    <div>
      <Topbar title="Settings" crumbs={["Workspace", "Settings"]} actions={<Button size="sm" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}><Save /> Save</Button>} />
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 md:px-8">
        {saved && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">Saved (demo).</p>}
        <Rise>
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Generic demo identity</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Display name</Label><Input defaultValue="Student" /></div>
              <div><Label>Timezone</Label><Input defaultValue="UTC" /></div>
            </CardContent>
          </Card>
        </Rise>
        <Stagger className="space-y-4">
          <Item>
            <Card>
              <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {["English", "Deutsch", "Français"].map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={cn("rounded-full border px-4 py-1.5 text-[13px] transition", lang === l ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>{l}</button>
                ))}
                <span className="w-full" />
                {["Light", "Standard", "Intensive"].map((p) => (
                  <button key={p} onClick={() => setPace(p)} className={cn("rounded-full border px-4 py-1.5 text-[13px] transition", pace === p ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>{p}</button>
                ))}
              </CardContent>
            </Card>
          </Item>
          <Item>
            <Card>
              <CardHeader><CardTitle>Exam prefs</CardTitle><CardDescription>Generic defaults</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div><Label>Exam date</Label><Input type="date" /></div>
                <div><Label>Daily goal (min)</Label><Input type="number" defaultValue={30} /></div>
              </CardContent>
            </Card>
          </Item>
          <Item>
            <Card>
              <CardHeader><CardTitle>Account</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline"><Download /> Export data</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const { createClient } = await import("@/utils/supabase/client");
                  await createClient().auth.signOut();
                  window.location.href = "/signin";
                }}><LogOut /> Sign out</Button>
                {!confirmDel ? (
                  <Button size="sm" variant="outline" onClick={() => setConfirmDel(true)}><Trash2 /> Delete</Button>
                ) : (
                  <span className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-[13px]">
                    <Badge tone="warn">Confirm?</Badge>
                    <button className="font-semibold text-red-600">Delete</button>
                    <button onClick={() => setConfirmDel(false)} className="text-muted-foreground">Keep</button>
                  </span>
                )}
              </CardContent>
            </Card>
          </Item>
        </Stagger>
      </div>
    </div>
  );
}
