"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, RotateCcw, Settings, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard", label: "My Courses", icon: Library },
  { href: "/revision", label: "Revision Center", icon: RotateCcw },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Requiem</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.slice(0, 3).map((n) => {
          const active = path === n.href || (n.href !== "/dashboard" && path?.startsWith(n.href.split("/").slice(0, 3).join("/")));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition",
                active ? "bg-foreground text-background" : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          );
        })}
        <Link href="/courses/new" className="mt-2 flex items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2 text-[13.5px] font-medium text-foreground/70 transition hover:border-foreground/30 hover:text-foreground">
          <Plus className="size-4" /> New course
        </Link>
        <div className="flex-1" />
        <Link href="/settings" className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium", path?.startsWith("/settings") ? "bg-foreground text-background" : "text-foreground/70 hover:bg-muted")}>
          <Settings className="size-4" /> Settings
        </Link>
        <div className="m-3 flex items-center gap-2.5 rounded-xl bg-muted p-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">S</span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold">Student</p>
            <p className="truncate text-[11px] text-muted-foreground">Workspace</p>
          </div>
        </div>
      </nav>
    </aside>
  );
}

export function Topbar({ title, crumbs, actions }: { title: string; crumbs?: string[]; actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 md:px-8">
        <div className="min-w-0">
          {crumbs && <p className="truncate text-[11.5px] text-muted-foreground">{crumbs.join("  /  ")}</p>}
          <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
