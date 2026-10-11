"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Chrome, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Rise, Stagger, Item } from "@/components/motion";
import { createClient } from "@/utils/supabase/client";

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

function SigninInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "oauth"
      ? "Google sign-in didn't complete. Please try again."
      : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (err) throw err;
      // Confirm the session actually landed before leaving: a silent push
      // with no session is exactly the "stuck on sign-in" loop.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Signed in but the session wasn't saved (browser is blocking cookies or storage). Enable cookies and retry.");
      }
      // Full navigation so middleware + server components see the fresh
      // session cookies on first load — client-side push can race them.
      window.location.assign(safeNext(params.get("next")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(params.get("next")))}` }
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    }
  }

  async function recover() {
    if (!/.+@.+\..+/.test(email)) {
      setError("Enter your email first, then use password recovery.");
      return;
    }
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/signin`
      });
      if (err) throw err;
      setError("Recovery email sent — check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed.");
    }
  }

  return (
    <Rise>
      <Stagger>
        <Item><h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1></Item>
        <Item><p className="mt-1 text-sm text-muted-foreground">Sign in to continue.</p></Item>
        <Item>
          <Card className="mt-6">
            <CardContent className="space-y-3 pt-5">
              <form className="space-y-3" onSubmit={submit}>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@demo.dev" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw">Password</Label>
                    <button type="button" onClick={recover} className="mb-1.5 text-xs text-muted-foreground hover:text-foreground">Forgot?</button>
                  </div>
                  <Input id="pw" type="password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} />
                </div>
                {error && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight /></>}
                </Button>
              </form>
              <Button variant="outline" className="w-full" type="button" onClick={google}>
                <Chrome /> Google
              </Button>
            </CardContent>
          </Card>
        </Item>
        <Item>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            New here? <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">Create account</Link>
          </p>
        </Item>
      </Stagger>
    </Rise>
  );
}

export default function SigninPage() {
  return (
    <Suspense>
      <SigninInner />
    </Suspense>
  );
}
