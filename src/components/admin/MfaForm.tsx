"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, input } from "@/components/ui/styles";
import { isValidOtpCode, toOtpCode } from "@/lib/auth/otp-code";
import { createClient } from "@/lib/supabase/client";

type Props = { mode: "enroll" | "verify"; factorId: string | null; next: string };
type Enrollment = { factorId: string; qrCode: string; secret: string };

const TOTP_LENGTH = 6;

/** 管理員兩步驟驗證：還沒綁定驗證器 → 顯示 QR Code 與密鑰；已綁定 → 輸入 6 位數驗證碼。成功後整頁導向原本要去的後台頁。 */
export function MfaForm({ mode, factorId, next }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(mode === "enroll");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "enroll") return;
    let cancelled = false;
    (async () => {
      // 先清掉上次沒綁完的因子，否則同名的 enroll 會失敗
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
      if (cancelled) return;
      setLoading(false);
      if (e || !data) {
        setError("無法產生驗證器設定，請重新整理頁面再試");
        return;
      }
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => { cancelled = true; };
  }, [mode, supabase]);

  const activeFactorId = mode === "enroll" ? enrollment?.factorId ?? null : factorId;

  async function submit() {
    if (!activeFactorId) return;
    setError(null);
    if (!isValidOtpCode(code, TOTP_LENGTH, TOTP_LENGTH)) {
      setError("請輸入驗證器上的 6 位數驗證碼");
      return;
    }
    setPending(true);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: activeFactorId });
    if (e1 || !ch) {
      setPending(false);
      setError(e1?.status === 429 ? "嘗試太頻繁，請稍後再試" : "無法開始驗證，請重新整理頁面再試");
      return;
    }
    const { error: e2 } = await supabase.auth.mfa.verify({ factorId: activeFactorId, challengeId: ch.id, code });
    if (e2) {
      setPending(false);
      setCode("");
      codeRef.current?.focus();
      setError(e2.status === 429 ? "嘗試太頻繁，請稍後再試" : "驗證碼錯誤或已過期，請輸入驗證器上目前的 6 位數");
      return;
    }
    // 後台頁面是伺服器端渲染，需要整頁導覽讓新的 session（aal2）cookie 生效。
    window.location.assign(next);
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 space-y-4">
      {mode === "enroll" ? (
        <>
          <p className="text-sm text-muted">管理後台需要兩步驟驗證。請用驗證器 App（Google Authenticator、1Password 等）掃描下方 QR Code，再輸入 App 顯示的 6 位數驗證碼完成綁定。</p>
          {loading && <p className="text-sm text-muted">產生中…</p>}
          {enrollment && (
            <div className="space-y-3">
              {/* QR Code 是 Supabase 回傳的 data URI（CSP img-src 已允許 data:） */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qrCode} alt="驗證器 QR Code" width={192} height={192} className="mx-auto rounded-input border border-line bg-surface p-2" />
              <p className="text-sm text-muted">無法掃描時，請在驗證器手動輸入這組密鑰：</p>
              <p className="break-all rounded-input border border-line bg-subtle px-3 py-2 font-mono text-sm text-ink select-all">{enrollment.secret}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">請輸入驗證器 App 目前顯示的 6 位數驗證碼。</p>
      )}
      <label htmlFor="mfa-code" className="sr-only">驗證碼</label>
      <input
        id="mfa-code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={TOTP_LENGTH} aria-required="true"
        aria-invalid={error ? true : undefined} aria-describedby={error ? "mfa-error" : undefined}
        value={code} onChange={(e) => setCode(toOtpCode(e.target.value, TOTP_LENGTH))} placeholder="6 位數驗證碼"
        disabled={!activeFactorId} className={`${input} tracking-widest`}
      />
      <button type="submit" disabled={pending || !activeFactorId} className={`${btn.primary} w-full`}>
        {mode === "enroll" ? "完成綁定" : "驗證"}
      </button>
      <ErrorText id="mfa-error" message={error} />
    </form>
  );
}
