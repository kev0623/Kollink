"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { classifyError, digestOf, ERROR_COPY, supportSubject } from "@/lib/errors/classify";
import { CopyButton } from "./CopyButton";
import { SupportLink } from "./SupportLink";
import { ThreadMark } from "./ThreadMark";
import { btn, h1 } from "./styles";

type Props = {
  error: unknown;
  retry: () => void;
  /** page：整頁（沒有外殼時，自己輸出 <main>）；section：在後台外殼的內容區裡 */
  scope: "page" | "section";
  /** 第二顆按鈕：回哪裡 */
  home: { href: string; label: string };
};

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * 錯誤畫面（error.tsx 共用）：說明發生什麼事、能做什麼。三種情況：沒有網路、網站剛更新（舊分頁）、其他。
 * 沒有網路時，連上線會自動重試。伺服器端錯誤會帶識別碼（digest），可以複製給客服。
 */
export function ErrorScreen({ error, retry, scope, home }: Props) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const kind = classifyError(error, online);
  const copy = ERROR_COPY[kind];
  const digest = digestOf(error);
  const [pending, startTransition] = useTransition();
  const [tries, setTries] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasOffline = useRef(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  // 換到錯誤畫面時，把焦點移到標題：螢幕報讀器與鍵盤使用者才知道頁面變了
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function run() {
    if (kind === "stale-build") {
      window.location.reload();
      return;
    }
    setTries((n) => n + 1);
    startTransition(() => retry());
  }

  // 網路恢復：自動重試一次
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      startTransition(() => retry());
    }
  }, [online, retry]);

  const body = (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center text-center">
      <ThreadMark variant={kind === "offline" ? "broken" : "tangled"} />
      <h1 ref={headingRef} tabIndex={-1} className={`${h1} mt-6 text-balance outline-none`}>{copy.title}</h1>
      <p className="mt-3 text-sm text-muted">{copy.body}</p>
      {kind === "generic" && tries >= 2 && (
        <p className="mt-2 text-sm text-ink">試了幾次都沒有成功，可能是我們這邊的問題。先回到其他頁面，或聯絡我們。</p>
      )}
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <button type="button" onClick={run} disabled={pending} className={btn.primary}>
          {pending ? "重新載入中…" : copy.primary}
        </button>
        <Link href={home.href} className={btn.secondary}>{home.label}</Link>
      </div>
      {kind === "generic" && (
        <div className="mt-8 w-full border-t border-line pt-5 text-sm">
          {digest && (
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-muted">
              <span>錯誤代碼</span>
              <code className="break-all font-sans font-semibold tabular-nums text-ink">{digest}</code>
              <CopyButton text={digest} label="複製代碼" />
            </p>
          )}
          <div className="flex justify-center"><SupportLink subject={supportSubject(digest)} /></div>
        </div>
      )}
    </div>
  );

  if (scope === "section") return <div className="py-10 md:py-16">{body}</div>;
  return (
    <main id="main" className="flex min-h-[70vh] flex-col justify-center px-4 py-16">
      {body}
    </main>
  );
}
