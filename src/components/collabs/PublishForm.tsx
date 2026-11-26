"use client";

import { useId, useState } from "react";
import { publishCollabAction } from "@/app/creator/collabs/actions";
import { isValidPostUrl } from "@/lib/validation/collab";
import { inputClass } from "@/components/forms/Field";
import { useCollabAction } from "./useCollabAction";

/** 填入貼文連結：前端先用 new URL() 檢查（擋 a..b.com 這類），伺服器與資料庫再各擋一次。 */
export function PublishForm({ collabId }: { collabId: string }) {
  const [url, setUrl] = useState("");
  const { pending, error, notice, run, setError } = useCollabAction();
  const id = useId();
  return (
    <form
      noValidate className="w-full space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = url.trim();
        if (!isValidPostUrl(v)) return setError("請貼上完整的貼文網址（https:// 開頭、含路徑）");
        run(() => publishCollabAction(collabId, v));
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold text-ink">貼文連結</label>
      <input
        id={id} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={pending}
        placeholder="https://www.instagram.com/p/..." aria-invalid={error ? true : undefined} className={inputClass}
      />
      <button disabled={pending} className="h-11 w-full rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60 sm:w-auto">
        {pending ? "送出中…" : "送出貼文連結"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </form>
  );
}
