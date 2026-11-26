"use client";

import { useEffect, useRef, useState } from "react";
import { isValidOtpCode, OTP_MAX_LENGTH, toOtpCode } from "@/lib/auth/otp-code";
import { LINE_LINK_ERRORS, type LineLinkError } from "@/lib/auth/line/messages";
import { btn, input } from "@/components/ui/styles";
import { ErrorText } from "@/components/ui/ErrorText";

const RESEND_SECONDS = 60;
const ERROR_ID = "line-link-error";

function isLinkError(v: unknown): v is LineLinkError {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(LINE_LINK_ERRORS, v);
}

/** 伺服器回的路徑只接受站內相對路徑 */
function safeRedirect(v: unknown): string | null {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}

/**
 * LINE 登入後的 Email 驗證碼步驟（與 Email 登入的驗證碼畫面相同的操作）。
 * 驗證碼送到 POST /auth/line/link；Email 只存在伺服器的加密 cookie 裡，畫面上不顯示也不經過網址。
 */
export function LineLinkForm({ onCancelHref }: { onCancelHref: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function post(body: Record<string, string>): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch("/auth/line/link", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
      });
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  function fail(e: unknown) {
    setAttempt((n) => n + 1);
    setError(isLinkError(e) ? LINE_LINK_ERRORS[e] : LINE_LINK_ERRORS.failed);
  }

  async function verify() {
    setError(null);
    setSent(false);
    if (!isValidOtpCode(code.trim())) {
      fail("format");
      return;
    }
    setPending(true);
    const r = await post({ action: "verify", code: code.trim() });
    const to = safeRedirect(r?.redirect);
    if (!to) {
      setPending(false);
      setCode("");
      codeRef.current?.focus();
      fail(r?.error);
      return;
    }
    setDone(true);
    window.location.assign(to);
  }

  async function resend() {
    setError(null);
    setSent(false);
    setPending(true);
    const r = await post({ action: "resend" });
    setPending(false);
    if (r?.ok !== true) {
      fail(r?.error);
      return;
    }
    setSent(true);
    setCooldown(RESEND_SECONDS);
  }

  return (
    <div>
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
          <button type="button" disabled={cooldown > 0 || pending || done} onClick={() => void resend()} className={btn.ghost}>
            {cooldown > 0 ? `${cooldown} 秒後可以重寄` : "重寄驗證碼"}
          </button>
          <a href={onCancelHref} className={btn.ghost}>改用其他方式登入</a>
        </div>
      </form>
      {sent && <p role="status" className="mt-3 text-sm text-muted">已重新寄出驗證碼。</p>}
      <div key={attempt} className="mt-3"><ErrorText id={ERROR_ID} message={error} /></div>
    </div>
  );
}
