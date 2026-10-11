import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Rise } from "@/components/motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background text-foreground md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:flex">
        <div className="paper-grid absolute inset-0 opacity-10" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-foreground text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Requiem</span>
        </Link>
        <Rise className="relative">
          <p className="font-serif text-4xl leading-tight">Learn anything,<br />remember everything.</p>
          <p className="mt-3 max-w-xs text-sm text-primary-foreground/70">Organize material. Practice. Revise.</p>
        </Rise>
        <p className="relative text-xs text-primary-foreground/50">Demo only — no backend.</p>
      </div>
      <main className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
