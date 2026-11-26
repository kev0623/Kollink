import type { CurrentUser } from "@/lib/auth/current-user";
import { CopyButton } from "@/components/ui/CopyButton";
import { Notice } from "@/components/ui/Notice";
import { SupportLink } from "@/components/ui/SupportLink";
import { ResubmitButton } from "./ResubmitButton";

function Code({ code }: { code: string }) {
  return (
    <span className="mt-2 inline-flex flex-wrap items-center gap-2">
      <b className="rounded-input border border-line-strong bg-surface px-3 py-1 font-mono text-base tracking-[0.3em] text-ink">{code}</b>
      <CopyButton text={code} label="複製驗證碼" />
    </span>
  );
}

export function StatusBanner({ me }: { me: CurrentUser }) {
  const s = me.creator?.status;
  if (s === "pending") {
    return (
      <Notice tone="info" title="審核中" className="mb-6">
        {me.verificationCode && (
          <>
            <p>請把驗證碼暫時加到 IG 自我介紹，審核通過後就可以刪掉。</p>
            <Code code={me.verificationCode} />
          </>
        )}
      </Notice>
    );
  }
  if (s === "rejected") {
    return (
      <Notice tone="danger" title="審核沒有通過，請修正後重新送審" className="mb-6">
        {me.creator?.reviewNote && <p className="whitespace-pre-wrap break-words">原因：{me.creator.reviewNote}</p>}
        {me.verificationCode && (<><p className="mt-1">驗證碼要在 IG 自我介紹裡。</p><Code code={me.verificationCode} /></>)}
        <div className="mt-3"><ResubmitButton /></div>
      </Notice>
    );
  }
  if (s === "suspended") {
    return (
      <Notice tone="danger" title="帳號已暫停" className="mb-6">
        {me.creator?.reviewNote && <p className="whitespace-pre-wrap break-words">原因：{me.creator.reviewNote}</p>}
        <p className="mt-1">暫停期間不能報名、接案或傳訊息。對暫停有疑問，請聯絡客服：</p>
        <SupportLink subject="帳號暫停" />
      </Notice>
    );
  }
  return null;
}
