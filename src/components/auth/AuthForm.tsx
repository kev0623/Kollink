"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProviderStatus } from "@/lib/auth/oauth-provider";
import { isValidOtpCode, OTP_MAX_LENGTH, toOtpCode } from "@/lib/auth/otp-code";
import { isEmail } from "@/lib/validation/onboarding";
import { btn, input } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";

type Props = { role: "brand" | "creator" | null; next: string | null; googleEnabled: boolean };

const RESEND_SECONDS = 60;
const ERROR_ID = "auth-error";

export function AuthForm({ role, next, googleEnabled }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState(false);
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
    if (!isEmail(email.trim())) {
      setAttempt((n) => n + 1);
      setError("請輸入正確的 Email，例如 you@example.com");
      return;
    }
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
    if (!isValidOtpCode(code.trim())) {
      setError("請輸入信件裡的 6 到 8 位數驗證碼");
      return;
    }
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
    setDone(true);
    // /auth/continue 是 route handler，需要整頁導覽（不是 Next 頁面）。
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/auth/continue${qs}`);
  }

  async function google() {
    setError(null);
    setPending(true);
    setGooglePending(true);
    // Supabase 後台沒開 Google 時，導過去只會看到 JSON 錯誤：先檢查，留在這裡顯示訊息
    const status = await fetchProviderStatus(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", "google",
    );
    if (status === "disabled") {
      setPending(false);
      setGooglePending(false);
      setAttempt((n) => n + 1);
      setError("Google 登入目前無法使用，請先改用 Email 驗證碼登入");
      return;
    }
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${qs}` },
    });
    if (e) {
      setPending(false);
      setGooglePending(false);
      setAttempt((n) => n + 1);
      setError("無法使用 Google 登入，請改用 Email");
    }
  }

  return (
    <div>
      {googleEnabled && (
        <>
          <button type="button" onClick={google} disabled={pending} className={`${btn.secondary} w-full`}>
            {googlePending ? "前往 Google 中…" : "用 Google 繼續"}
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />或用 Email<span className="h-px flex-1 bg-line" /></div>
        </>
      )}

      {step === "email" ? (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="space-y-3">
          <label htmlFor="auth-email" className="text-sm font-bold text-ink">Email</label>
          <input
            id="auth-email" type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@example.com"
            aria-invalid={error ? true : undefined} aria-describedby={error ? ERROR_ID : undefined} className={input}
          />
          <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
            {pending ? "寄送中…" : "寄驗證碼"}
          </button>
        </form>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-3">
          <p className="break-words text-sm text-muted">驗證碼已寄到 <span className="font-bold text-ink">{email}</span>，請在 10 分鐘內輸入。</p>
          <label htmlFor="auth-code" className="text-sm font-bold text-ink">驗證碼</label>
          <input
            id="auth-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_MAX_LENGTH}
            value={code} onChange={(e) => { setCode(toOtpCode(e.target.value)); setError(null); }} placeholder="6 到 8 碼"
            aria-invalid={error ? true : undefined} aria-describedby={error ? ERROR_ID : undefined} className={`${input} tracking-[0.3em]`}
          />
          <button type="submit" disabled={pending || done} className={`${btn.primary} w-full`}>
            {done ? "登入成功，正在帶你進去…" : pending ? "登入中…" : "登入"}
          </button>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" disabled={cooldown > 0 || pending} onClick={() => void sendCode()} className={btn.ghost}>
              {cooldown > 0 ? `${cooldown} 秒後可以重寄` : "重寄驗證碼"}
            </button>
            <button type="button" disabled={pending} onClick={() => { setStep("email"); setCode(""); setError(null); }} className={btn.ghost}>
              更改 Email
            </button>
          </div>
        </form>
      )}

      <div key={attempt} className="mt-3"><ErrorText id={ERROR_ID} message={error} /></div>
    </div>
  );
}
