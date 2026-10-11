import Link from "next/link";
import { ArrowRight, Sparkles, Upload, Brain, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rise, Stagger, Item } from "@/components/motion";

const pillars = [
  { icon: Upload, title: "Organize", text: "Syllabus + PDFs become modules." },
  { icon: Brain, title: "Learn", text: "Grounded AI, cited to your pages." },
  { icon: PenLine, title: "Create", text: "Think on an infinite canvas." }
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
          <span className="font-semibold tracking-tight">Requiem</span>
        </span>
        <div className="flex items-center gap-2">
          <Link href="/signin"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link href="/signup"><Button size="sm">Get started <ArrowRight /></Button></Link>
        </div>
      </nav>

      <section className="paper-grid relative mx-auto max-w-6xl px-6 pb-16 pt-14 text-center md:pt-24">
        <Rise>
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" /> AI learning workspace
          </p>
        </Rise>
        <Rise delay={0.08}>
          <h1 className="mx-auto max-w-3xl font-serif text-5xl leading-[1.04] tracking-tight md:text-7xl">
            Study from <em className="italic">your</em> material.
          </h1>
        </Rise>
        <Rise delay={0.16}>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Upload PDFs. Get cited explanations, quizzes, and a canvas for real understanding.
          </p>
        </Rise>
        <Rise delay={0.24}>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup"><Button size="lg">Start learning <ArrowRight /></Button></Link>
            <Link href="/dashboard"><Button size="lg" variant="outline">View demo</Button></Link>
          </div>
        </Rise>

        <Rise delay={0.32}>
          <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="size-2.5 rounded-full bg-muted-foreground/20" /><span className="size-2.5 rounded-full bg-muted-foreground/20" /><span className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="ml-3 text-xs text-muted-foreground">requiem — course workspace</span>
            </div>
            <div className="grid gap-3 p-4 text-left md:grid-cols-3">
              {["Modules mapped", "AI cited", "Canvas saved"].map((t, i) => (
                <div key={t} className="rounded-xl bg-muted p-4">
                  <p className="font-mono text-[11px] text-muted-foreground">0{i + 1}</p>
                  <p className="mt-1 text-sm font-semibold">{t}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-2/3 rounded-full bg-foreground" /></div>
                </div>
              ))}
            </div>
          </div>
        </Rise>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Stagger className="grid gap-3 md:grid-cols-3">
          {pillars.map((p) => (
            <Item key={p.title}>
              <Card className="card-hover">
                <CardContent className="p-6">
                  <p.icon className="size-5" />
                  <h3 className="mt-3 font-semibold tracking-tight">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
                </CardContent>
              </Card>
            </Item>
          ))}
        </Stagger>
        <Rise delay={0.1} className="mt-10 flex justify-center">
          <Link href="/onboarding"><Button variant="secondary">See how it works <ArrowRight /></Button></Link>
        </Rise>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Requiem — source-grounded learning. No noise.
      </footer>
    </main>
  );
}
