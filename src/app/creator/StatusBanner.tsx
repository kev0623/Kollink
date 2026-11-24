import type { CurrentUser } from "@/lib/auth/current-user";

export function StatusBanner({ me }: { me: CurrentUser }) {
  if (me.creator?.status === "pending") {
    return (
      <div className="mb-6 rounded-card border border-line bg-surface p-5 text-sm">
        <p className="font-bold">審核中，通常 1–2 個工作天。</p>
        {me.verificationCode && (
          <p className="mt-1">
            請把驗證碼 <b className="rounded-btn bg-ink px-2 py-0.5 tracking-widest text-on-ink">{me.verificationCode}</b> 暫時加到 IG 自我介紹，審核通過後就可以刪掉。
          </p>
        )}
      </div>
    );
  }
  if (me.creator?.status === "suspended") {
    return (
      <div className="mb-6 rounded-card border border-line bg-surface p-5 text-sm">
        <p className="font-bold">帳號已暫停，請聯絡客服。</p>
      </div>
    );
  }
  return null;
}
