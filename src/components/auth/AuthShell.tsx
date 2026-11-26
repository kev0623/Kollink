import Link from "next/link";
import { ThreadCanvas } from "@/components/thread/ThreadCanvas";
import { ThemeSelect } from "@/components/theme/ThemeSelect";
import { SkipLink } from "@/components/ui/SkipLink";
import { textLink } from "@/components/ui/styles";
import { PRIVACY_PAGE, SITE_NAME, TERMS_PAGE } from "@/lib/site";

/** 登入／註冊外框（規格 §7）：桌面左 55% 是安靜的紅線，右邊是實心表單；手機是 160px 的紅線帶＋表單。 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-bg md:grid md:grid-cols-[55fr_45fr]">
      <SkipLink />
      <div className="relative isolate h-40 overflow-hidden md:h-auto md:min-h-[100svh]">
        <ThreadCanvas variant="quiet" />
        <Link href="/" className="absolute left-5 top-4 z-10 flex h-11 items-center gap-2 text-lg font-extrabold text-ink md:left-12 md:top-8">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-thread" />{SITE_NAME}
        </Link>
        <p className="absolute bottom-12 left-12 z-10 hidden max-w-md font-serif text-[28px] font-bold leading-snug text-ink md:block">
          每一次合作，都從一條線開始。
        </p>
      </div>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col justify-center bg-bg px-4 py-8 outline-none md:bg-panel md:px-12">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="rounded-card border border-line bg-surface p-5 md:p-8">{children}</div>
          <p className="mt-4 flex flex-wrap items-center justify-center text-center text-xs text-muted">
            繼續即表示你同意<Link href={TERMS_PAGE} className={`${textLink} text-xs`}>《服務條款》</Link>與
            <Link href={PRIVACY_PAGE} className={`${textLink} text-xs`}>《隱私權政策》</Link>
          </p>
          <div className="mt-2 flex justify-center"><ThemeSelect /></div>
        </div>
      </main>
    </div>
  );
}
