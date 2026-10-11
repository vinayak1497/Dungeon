"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chrome, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Rise, Stagger, Item } from "@/components/motion";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const emailOk = /.+@.+\..+/.test(email);
  const pwOk = pw.length >= 8;
  const matchOk = pw.length > 0 && pw === confirm;
  const valid = name.trim().length > 1 && emailOk && pwOk && matchOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: { data: { display_name: name.trim() } }
      });
      if (err) throw err;
      // Email confirmation may be required before a session exists.
      if (!data.session) {
        setCheckEmail(true);
        return;
      }
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
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
        options: { redirectTo: `${window.location.origin}/onboarding` }
      });
      if (err) throw err;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    }
  }

  return (
    <Rise>
      <Stagger>
        <Item><h1 className="text-2xl font-semibold tracking-tight">Create account</h1></Item>
        <Item><p className="mt-1 text-sm text-muted-foreground">Start learning in seconds.</p></Item>
        <Item>
          <Card className="mt-6">
            <CardContent className="space-y-3 pt-5">
              {checkEmail ? (
                <p className="rounded-xl border border-border bg-muted px-3 py-2 text-[13px]">
                  Account created — check your email to confirm, then sign in.
                </p>
              ) : (
                <form className="space-y-3" onSubmit={submit}>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="Student" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@demo.dev" value={email} onChange={(e) => setEmail(e.target.value)} />
                    {email.length > 0 && !emailOk && <p className="mt-1 text-xs text-amber-700">Enter a valid email.</p>}
                  </div>
                  <div>
                    <Label htmlFor="pw">Password</Label>
                    <Input id="pw" type="password" placeholder="8+ characters" value={pw} onChange={(e) => setPw(e.target.value)} />
                    {pw.length > 0 && !pwOk && <p className="mt-1 text-xs text-amber-700">Min 8 characters.</p>}
                  </div>
                  <div>
                    <Label htmlFor="confirm">Confirm</Label>
                    <Input id="confirm" type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    {confirm.length > 0 && !matchOk && <p className="mt-1 text-xs text-amber-700">Passwords must match.</p>}
                  </div>
                  {error && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">{error}</p>}
                  <Button type="submit" className="w-full" disabled={!valid || loading}>
                    {loading ? <><Loader2 className="animate-spin" /> Creating…</> : <>Create account <ArrowRight /></>}
                  </Button>
                </form>
              )}
              <Button variant="outline" className="w-full" type="button" onClick={google}>
                <Chrome /> Continue with Google
              </Button>
            </CardContent>
          </Card>
        </Item>
        <Item>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            Have an account? <Link href="/signin" className="font-medium text-foreground underline-offset-4 hover:underline">Sign in</Link>
          </p>
        </Item>
      </Stagger>
    </Rise>
  );
}
