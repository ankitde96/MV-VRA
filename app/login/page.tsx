"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError("Invalid email or password.");
        return;
      }

      const destination = searchParams.get("from") || "/dashboard";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="hidden flex-col justify-between p-10 text-white lg:flex"
        style={{ background: "var(--ink-dark)" }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">MV-VRA</span>
        </div>
        <div className="max-w-sm space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Vendor risk, under control.
          </h2>
          <p className="text-sm text-white/80">
            Intake, tiering, questionnaires, and executive roll-up — one system
            of record for third-party risk.
          </p>
        </div>
        <p className="text-xs text-white/50">
          MoneyView Vendor Risk Assessment
        </p>
      </div>

      <div className="bg-background flex flex-1 items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <ShieldCheck
              className="text-primary mb-2 size-6 lg:hidden"
              aria-hidden="true"
            />
            <h1 className="text-foreground text-xl font-semibold">
              Internal sign in
            </h1>
            <p className="text-muted-foreground text-sm">
              Risk and admin team access only.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <Link
            href="/portal/login"
            className="block text-center text-sm font-medium text-primary hover:underline"
          >
            I&apos;m a vendor — sign in with a code →
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
