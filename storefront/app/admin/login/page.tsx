"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendOtp, verifyOtp } from "./actions";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await sendOtp(email);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setNotice(`We emailed a 6-digit code to ${email.trim().toLowerCase()}.`);
      setStep("code");
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyOtp(email, code);
      if (!res.ok) {
        setError(res.error ?? "Invalid code.");
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <main className="admin-theme relative flex min-h-screen items-center justify-center bg-ink px-4 bg-grid">
      <div className="admin-aurora" aria-hidden />
      <div className="admin-enter relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-gradient-to-br from-accent/15 to-accent-2/10 text-accent shadow-[0_0_24px_-6px_rgba(55,226,212,0.5)]">
            <span className="font-mono text-lg font-bold">EC</span>
          </div>
          <h1 className="text-xl font-semibold text-fg">East Coast Labs</h1>
          <p className="mt-1 text-sm text-muted">Admin sign-in</p>
        </div>

        <div className="admin-card rounded-2xl p-6">
          {step === "email" ? (
            <form onSubmit={submitEmail} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm text-fg-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@eastcoastlabs.com.au"
                  className="w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-fg outline-none transition focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send code"}
              </button>
              {/* Codes minted out-of-band (scripts/admin.mjs code <email>) must be
                  usable WITHOUT pressing Send code — every send rotates the OTP and
                  would invalidate the code the operator is holding. */}
              <button
                type="button"
                onClick={() => {
                  if (!email.trim().includes("@")) {
                    setError("Enter your email address first.");
                    return;
                  }
                  setError(null);
                  setNotice("Enter the code you were given.");
                  setStep("code");
                }}
                className="w-full text-center text-xs text-muted hover:text-fg-2"
              >
                I already have a code
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-4">
              {notice && <p className="text-sm text-muted">{notice}</p>}
              <div>
                <label htmlFor="code" className="mb-1.5 block text-sm text-fg-2">
                  Sign-in code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-fg outline-none transition focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95 disabled:opacity-60"
              >
                {pending ? "Verifying…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setNotice(null);
                }}
                className="w-full text-center text-xs text-muted hover:text-fg-2"
              >
                Use a different email
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-warn">{error}</p>}
        </div>

        <p className="mt-6 text-center text-xs text-muted-2">
          Access is restricted to authorised East Coast Labs operators.
        </p>
      </div>
    </main>
  );
}
