"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * DESIGN-SYSTEM.md §4 `OtpForm`: "6 separate inputs, paste-aware, autocomplete
 * one-time-code, attempts-remaining message" — built on the `input-otp` primitive, which
 * is paste-aware and exposes `autoComplete="one-time-code"` itself. There is no
 * attempts-remaining count to show: `/api/portal/auth/otp/verify` (lib/auth/otp.ts,
 * OTP_MAX_ATTEMPTS=5) doesn't return one, and adding that is an API change outside this
 * revamp's scope (UI-REVAMP-PLAN.md explicitly excludes `app/api/**`).
 */
function OtpLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      // Always succeeds and always shows the same next step — FLOW.md F2 gap (a). The UI
      // has no way to tell from this response whether the email matched a vendor.
      await fetch("/api/portal/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStep("code");
    } catch {
      toast.error("We couldn't send the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    setLoading(true);
    try {
      const response = await fetch("/api/portal/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        toast.error("That code is incorrect or has expired. Please try again.");
        setCode("");
        return;
      }

      const destination = searchParams.get("from") || "/portal";
      router.push(destination);
      router.refresh();
    } catch {
      toast.error("We couldn't verify that code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center">
      <Card className="glass-panel w-full max-w-md">
        <CardHeader>
          <h1 className="text-foreground text-xl font-semibold">
            Vendor sign in
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            {step === "email"
              ? "Enter your email address and we will send you a one-time verification code."
              : `We sent a 6-digit code to ${email}. Enter it below.`}
          </p>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleRequestCode} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  className="h-11 text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send code"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyCode();
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <InputOTP
                  id="code"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={setCode}
                  onComplete={handleVerifyCode}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="size-11 text-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading || code.length < 6}
              >
                {loading ? "Verifying…" : "Verify"}
              </Button>
              <button
                type="button"
                className="text-muted-foreground block w-full py-2 text-center text-sm underline"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PortalOtpLoginForm() {
  return (
    <Suspense>
      <OtpLoginForm />
    </Suspense>
  );
}
