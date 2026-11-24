"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { setFavoriteAction, type FavoriteResult } from "@/app/brand/actions";

type Props = { creatorId: string; name: string; initial: boolean };

/**
 * ♡ 收藏。按下後畫面先切換（useOptimistic），失敗時切回並顯示錯誤。
 * 伺服器重新渲染給了不同的 initial 時，用 key 重設內部狀態（例如從公開頁收藏後回到廣場）。
 */
export function FavoriteButton(props: Props) {
  return <FavoriteToggle key={String(props.initial)} {...props} />;
}

async function send(creatorId: string, favorite: boolean): Promise<FavoriteResult> {
  try {
    // 工作階段過期時 action 會 redirect 到登入頁，這裡可能拿到 undefined
    return (await setFavoriteAction(creatorId, favorite)) ?? { ok: false, error: "請重新登入" };
  } catch {
    return { ok: false, error: "網路連線失敗，請稍後再試" };
  }
}

function FavoriteToggle({ creatorId, name, initial }: Props) {
  const [saved, setSaved] = useState(initial);
  const [shown, setShown] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    // 卡片整張是連結：不要觸發跳頁
    e.preventDefault();
    e.stopPropagation();
    const next = !shown;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const res = await send(creatorId, next);
      startTransition(() => {
        if (res.ok) setSaved(next);
        else setError(res.error);
      });
    });
  }

  return (
    <span className="relative z-10 inline-flex shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={`收藏 ${name}`}
        aria-pressed={shown}
        title={shown ? "取消收藏" : "收藏"}
        className="flex h-10 w-10 items-center justify-center rounded-btn border border-line bg-surface text-ink hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Heart size={18} strokeWidth={1.5} aria-hidden="true" className={shown ? "fill-current" : ""} />
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full mt-1 w-max max-w-48 rounded-input border border-line bg-surface px-2 py-1 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
