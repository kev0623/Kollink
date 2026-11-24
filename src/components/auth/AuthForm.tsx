"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { role: "brand" | "creator" | null; next: string | null; googleEnabled: boolean };

const RESEND_SECONDS = 60;

/** 全形數字轉半形，只留數字，最多 6 碼。 */
function toCode(v: string) {
  return v
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\D/g, "")
    .slice(0, 6);
}

export function AuthForm({ role, next, googleEnabled }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const query = new URLSearchParams();
  if (role) query.set("role", role);
  if (next) query.set("next", next);
  const qs = query.toString() ? `?${query.toString()}` : "";

  async function sendCode() {
    setError(null);
    setPending(true);
    const { error: e } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setPending(false);
    if (e) {
      setAttempt((n) => n + 1);
      setError(e.status === 429 ? "寄送太頻繁，請稍後再試" : "無法寄出驗證碼，請確認 Email 是否正確");
      return;
    }
    setStep("code");
    setCooldown(RESEND_SECONDS);
  }

  async function verify() {
    setError(null);
    setPending(true);
    const { error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (e) {
      setPending(false);
      setCode("");
      setAttempt((n) => n + 1);
      codeRef.current?.focus();
      setError("驗證碼錯誤或已過期，請重新取得");
      return;
    }
    // /auth/continue 是 route handler，需要整頁導覽（不是 Next 頁面）。
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/auth/continue${qs}`);
  }

  async function google() {
    setError(null);
    setPending(true);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${qs}` },
    });
    if (e) {
      setPending(false);
      setAttempt((n) => n + 1);
      setError("無法使用 Google 登入，請改用 Email");
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
      <button
        type="button"
        onClick={google}
        disabled={!googleEnabled || pending}
        className="w-full rounded-btn border border-line px-4 py-2 font-bold disabled:cursor-not-allowed disabled:text-muted"
      >
        {googleEnabled ? "用 Google 繼續" : "Google 登入（尚未設定）"}
      </button>

      <div className="my-4 text-center text-sm text-muted">或用 Email 收驗證碼</div>

      {step === "email" ? (
        <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="space-y-3">
          <label htmlFor="auth-email" className="sr-only">Email</label>
          <input
            id="auth-email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="w-full rounded-btn border border-line px-3 py-2"
          />
          <button type="submit" disabled={pending} className="w-full rounded-btn bg-primary px-4 py-2 font-bold text-white disabled:opacity-60">
            寄驗證碼
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-3">
          <p className="text-sm text-muted">驗證碼已寄到 {email}，15 分鐘內有效</p>
          <label htmlFor="auth-code" className="sr-only">驗證碼</label>
          <input
            id="auth-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
            value={code} onChange={(e) => setCode(toCode(e.target.value))} placeholder="6 碼驗證碼"
            className="w-full rounded-btn border border-line px-3 py-2 tracking-widest"
          />
          <button type="submit" disabled={pending} className="w-full rounded-btn bg-primary px-4 py-2 font-bold text-white disabled:opacity-60">
            登入
          </button>
          <button
            type="button" disabled={cooldown > 0 || pending} onClick={() => void sendCode()}
            className="w-full text-sm text-muted disabled:opacity-60"
          >
            {cooldown > 0 ? `${cooldown} 秒後可以重寄` : "重寄驗證碼"}
          </button>
          <button
            type="button" disabled={pending}
            onClick={() => { setStep("email"); setCode(""); setError(null); }}
            className="w-full text-sm text-muted disabled:opacity-60"
          >
            更改 Email
          </button>
        </form>
      )}

      {error && <p key={attempt} role="alert" className="mt-3 text-sm text-primary">{error}</p>}
    </div>
  );
}
