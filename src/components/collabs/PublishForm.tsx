"use client";

import { useId, useState } from "react";
import { publishCollabAction } from "@/app/creator/collabs/actions";
import { ConfirmAction } from "@/components/briefs/ConfirmAction";
import { ErrorText } from "@/components/ui/ErrorText";
import { btn, input } from "@/components/ui/styles";
import { isValidPostUrl } from "@/lib/validation/collab";

/**
 * 填入貼文連結：前端先用 new URL() 檢查（擋 a..b.com 這類），伺服器與資料庫再各擋一次。
 * 檢查通過後展開確認（送出後進入撥款、連結不能再改）。
 */
export function PublishForm({ collabId }: { collabId: string }) {
  const [url, setUrl] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="w-full space-y-3">
      <form
        noValidate className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = url.trim();
          if (!isValidPostUrl(v)) return setError("請貼上完整的貼文網址（https:// 開頭、含路徑）");
          setError(null);
          setChecked(v);
        }}
      >
        <label htmlFor={id} className="text-sm font-bold text-ink">貼文連結</label>
        <input
          id={id} type="url" inputMode="url" value={url} placeholder="https://www.instagram.com/p/..."
          onChange={(e) => { setUrl(e.target.value); setChecked(null); setError(null); }}
          aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} className={input}
        />
        {!checked && <button className={`${btn.primary} w-full sm:w-auto`}>下一步：確認連結</button>}
        <div id={errId}><ErrorText message={error} /></div>
      </form>
      {checked && (
        <ConfirmAction
          label="送出貼文連結" icon="send" block confirmLabel="確定送出"
          message={`送出後會進入撥款，連結不能再改：${checked}`}
          onConfirm={() => publishCollabAction(collabId, checked)}
        />
      )}
    </div>
  );
}
