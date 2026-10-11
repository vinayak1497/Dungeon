import Link from "next/link";
import { CheckCircle2, ArrowRight, Compass, Library, Brain, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rise, Stagger, Item } from "@/components/motion";

const points = [
  { icon: Library, text: "Organize notes into courses" },
  { icon: Brain, text: "Learn with grounded AI" },
  { icon: RotateCcw, text: "Revise with spaced recall" },
];

export default function OnboardingCompletePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-background px-5 text-foreground">
      <Rise className="w-full text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">You&apos;re set</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what Requiem does.</p>
      </Rise>
      <Stagger className="mt-6 grid w-full gap-2">
        {points.map((p) => (
          <Item key={p.text}>
            <Card><CardContent className="flex items-center gap-2.5 py-3"><p.icon className="size-4 text-muted-foreground" /><p className="text-sm">{p.text}</p></CardContent></Card>
          </Item>
        ))}
      </Stagger>
      <div className="mt-6 grid w-full gap-2">
        <Button asChild><Link href="/courses/new">Create first course <ArrowRight /></Link></Button>
        <Button variant="outline" asChild><Link href="/dashboard"><Compass /> Explore demo</Link></Button>
      </div>
    </div>
  );
}
