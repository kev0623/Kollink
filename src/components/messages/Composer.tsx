"use client";

import { useState, useTransition } from "react";
import { sendMessageAction } from "@/lib/messages/actions";
import { contactKinds, contactWarning } from "@/lib/messages/contact";
import type { Message } from "@/lib/messages/view";
import { textLength } from "@/lib/validation/brief";
import { cleanMessageBody, MESSAGE_BODY_MAX, validateMessageBody } from "@/lib/validation/message";

/**
 * 輸入區。偵測到聯絡方式時先在下方提醒（不是 confirm()），按「仍要送出」才送；改了內容要重新確認。
 * Enter 換行；Ctrl／⌘ + Enter 送出。受控輸入，送出用 onSubmit（不用 form action，避免 React 重設欄位）。
 */
export function Composer({ conversationId, onSent }: { conversationId: string; onSent: (m: Message) => void }) {
  const [body, setBody] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = textLength(body);

  function send(force: boolean) {
    if (pending) return;
    const clean = cleanMessageBody(body);
    const err = validateMessageBody(clean);
    if (err) {
      setError(err);
      return;
    }
    const w = contactWarning(contactKinds(clean));
    if (w && !force) {
      setWarning(w);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await sendMessageAction(conversationId, clean);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setBody("");
        setWarning(null);
        onSent(res.message);
      } catch {
        setError("發生錯誤，請稍後再試");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
      className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] shrink-0 rounded-card border border-line bg-surface p-3 md:static"
    >
      <label htmlFor="message-body" className="sr-only">訊息</label>
      <textarea
        id="message-body"
        value={body}
        readOnly={pending}
        rows={2}
        placeholder="輸入訊息…"
        onChange={(e) => {
          setBody(e.target.value);
          setWarning(null);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send(false);
          }
        }}
        className="block max-h-40 min-h-11 w-full resize-y rounded-input border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
      />
      {warning && (
        <div role="alert" className="mt-2 rounded-input border border-line bg-subtle p-3 text-sm text-ink">
          <p>{warning}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending} onClick={() => send(true)}
              className="h-9 rounded-btn bg-ink px-4 text-sm font-semibold text-on-ink disabled:opacity-60">
              仍要送出
            </button>
            <button type="button" disabled={pending} onClick={() => setWarning(null)}
              className="h-9 rounded-btn border border-line bg-surface px-4 text-sm font-semibold text-ink">
              修改訊息
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className={`text-xs ${count > MESSAGE_BODY_MAX ? "text-danger" : "text-muted"}`}>
          {count} / {MESSAGE_BODY_MAX}<span className="hidden md:inline">・Ctrl／⌘ + Enter 送出</span>
        </span>
        <button type="submit" disabled={pending || warning !== null}
          className="h-11 rounded-btn bg-ink px-6 font-semibold text-on-ink disabled:opacity-60">
          {pending ? "送出中…" : "送出"}
        </button>
      </div>
    </form>
  );
}
