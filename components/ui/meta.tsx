import { cn } from "@/lib/utils";

export function Badge({ className, children, tone = "neutral" }: { className?: string; children: React.ReactNode; tone?: "neutral" | "accent" | "success" | "warn" }) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-foreground/80",
    accent: "bg-accent/12 text-[#4f43e8] border border-accent/25",
    success: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-700 border border-amber-500/25"
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium tracking-tight", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function SourceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/70">
      {label}
    </span>
  );
}
