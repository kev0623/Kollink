"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isValidOtpCode, OTP_MAX_LENGTH, toOtpCode } from "@/lib/auth/otp-code";
import { isLineLinkError, LINE_LINK_ERRORS, lineVerifyNotice, type LineLinkError } from "@/lib/auth/line/messages";
import { btn, input } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";

const RESEND_SECONDS = 60;
const ERROR_ID = "line-link-error";

/** 伺服器回的路徑只接受站內相對路徑 */
function safeRedirect(v: unknown): string | null {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}

/**
 * LINE 登入後的 Email 驗證碼步驟（/login?line=verify）。
 * 驗證碼的寄送與驗證都在瀏覽器用 Supabase 進行（與 Email 登入相同，頻率限制算在使用者自己的 IP）；
 * 驗證通過、session 建立後，POST /auth/line/link 只負責把 LINE 綁定到這個帳號。
 */
export function LineLinkForm({ onCancelHref }: { onCancelHref: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  // 驗證碼已通過（session 已建立）但綁定暫時失敗時，再按一次只重試綁定（驗證碼只能用一次）
  const verified = useRef(false);

  function fail(e: LineLinkError) {
    setAttempt((n) => n + 1);
    setError(LINE_LINK_ERRORS[e]);
  }

  async function send(to: string) {
    setError(null);
    setInfo(null);
    setPending(true);
    const { error: e } = await supabase.auth.signInWithOtp({ email: to, options: { shouldCreateUser: true } });
    setPending(false);
    setCooldown(RESEND_SECONDS);
    if (e?.status === 429) {
      // 剛寄過（例如重新整理頁面）：信箱裡的驗證碼仍然有效
      setInfo("驗證碼剛寄出過，請查看信箱；收不到的話稍後可以重寄。");
      return;
    }
    if (e) fail("send");
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      let to: string | null = null;
      try {
        const res = await fetch("/auth/line/pending", { cache: "no-store" });
        const body = (await res.json()) as { email?: unknown };
        to = typeof body.email === "string" ? body.email : null;
      } catch {
        to = null;
      }
      if (!to) {
        setExpired(true);
        return;
      }
      setEmail(to);
      await send(to);
      codeRef.current?.focus();
    })();
    // send 只在第一次載入時自動執行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify() {
    if (!email) return;
    setError(null);
    setInfo(null);
    if (!verified.current) {
      if (!isValidOtpCode(code.trim())) {
        fail("format");
        return;
      }
      setPending(true);
      const { error: e } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (e) {
        setPending(false);
        setCode("");
        codeRef.current?.focus();
        fail("code");
        return;
      }
      verified.current = true;
    }
    setPending(true);
    let body: { redirect?: unknown; error?: unknown } | null = null;
    try {
      const res = await fetch("/auth/line/link", { method: "POST", cache: "no-store" });
      body = (await res.json()) as { redirect?: unknown; error?: unknown };
    } catch {
      body = null;
    }
    const to = safeRedirect(body?.redirect);
    if (!to) {
      setPending(false);
      if (body?.error === "mismatch" || body?.error === "expired") setExpired(true);
      fail(isLineLinkError(body?.error) ? body.error : "failed");
      return;
    }
    setDone(true);
    window.location.assign(to);
  }

  if (expired) {
    return (
      <div>
        <div key={attempt}><ErrorText id={ERROR_ID} message={error ?? LINE_LINK_ERRORS.expired} /></div>
        <a href={onCancelHref} className={`${btn.secondary} mt-4 w-full`}>回登入頁</a>
      </div>
    );
  }
  if (!email) return <Skeleton className="h-[188px] w-full" />;

  return (
    <div>
      <Notice tone="info" className="mb-4">{lineVerifyNotice(email)}</Notice>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-3">
        <label htmlFor="line-code" className="text-sm font-bold text-ink">驗證碼</label>
        <input
          id="line-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_MAX_LENGTH}
          value={code} onChange={(e) => { setCode(toOtpCode(e.target.value)); setError(null); }} placeholder="6 到 8 碼"
          aria-invalid={error ? true : undefined} aria-describedby={error ? ERROR_ID : undefined} className={`${input} tracking-[0.3em]`}
        />
        <button type="submit" disabled={pending || done} className={`${btn.primary} w-full`}>
          {done ? "完成，正在帶你進去…" : pending ? "確認中…" : "確認並綁定 LINE"}
        </button>
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" disabled={cooldown > 0 || pending || done} onClick={() => void send(email)} className={btn.ghost}>
            {cooldown > 0 ? `${cooldown} 秒後可以重寄` : "重寄驗證碼"}
          </button>
          <a href={onCancelHref} className={btn.ghost}>改用其他方式登入</a>
        </div>
      </form>
      {info && <p role="status" className="mt-3 text-sm text-muted">{info}</p>}
      <div key={attempt} className="mt-3"><ErrorText id={ERROR_ID} message={error} /></div>
    </div>
  );
}
