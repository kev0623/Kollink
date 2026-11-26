"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ErrorText } from "@/components/ui/ErrorText";
import { Notice } from "@/components/ui/Notice";
import { btn, textarea } from "@/components/ui/styles";
import { sendMessageAction } from "@/lib/messages/actions";
import { contactKinds, contactWarning } from "@/lib/messages/contact";
import { composerCount, composerKeyAction, type Message } from "@/lib/messages/view";
import { cleanMessageBody, MESSAGE_BODY_MAX, validateMessageBody } from "@/lib/validation/message";

const FINE = "(pointer: fine)";
function subscribeFine(cb: () => void) {
  const mq = window.matchMedia(FINE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * 輸入區。偵測到聯絡方式時先在下方提醒（不是 confirm()），按「仍要送出」才送；改了內容要重新確認。
 * 桌面：Enter 送出、Shift + Enter 換行；觸控裝置 Enter 換行；Ctrl／⌘ + Enter 一律送出；選字中（IME）的 Enter 不送出。
 * 受控輸入，送出用 onSubmit（不用 form action，避免 React 重設欄位）。字數用與驗證相同的規則即時計算。
 */
export function Composer({ conversationId, onSent }: { conversationId: string; onSent: (m: Message) => void }) {
  const [body, setBody] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finePointer = useSyncExternalStore(subscribeFine, () => window.matchMedia(FINE).matches, () => true);
  const count = composerCount(body);
  const over = count > MESSAGE_BODY_MAX;

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
      className="sticky bottom-[calc(3.5rem+max(0.25rem,env(safe-area-inset-bottom)))] z-10 shrink-0 rounded-card border border-line bg-surface p-3 md:static"
    >
      <label htmlFor="message-body" className="sr-only">訊息</label>
      <textarea
        id="message-body"
        value={body}
        readOnly={pending}
        rows={2}
        placeholder="輸入訊息…"
        aria-invalid={over ? true : undefined}
        aria-describedby="message-count"
        onChange={(e) => {
          setBody(e.target.value);
          setWarning(null);
          setError(null);
        }}
        onKeyDown={(e) => {
          // 選字中的 Enter（isComposing；Safari 的 compositionend 之後 keyCode 仍是 229）不送出
          const composing = e.nativeEvent.isComposing || e.keyCode === 229;
          const a = composerKeyAction({ key: e.key, shift: e.shiftKey, composing, finePointer, mod: e.metaKey || e.ctrlKey });
          if (a === "send") {
            e.preventDefault();
            send(false);
          }
        }}
        className={`${textarea} max-h-40 min-h-11 resize-none`}
      />
      {warning && (
        <Notice tone="warning" className="mt-2">
          <p>{warning}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => send(true)} className={btn.primary}>仍要送出</button>
            <button type="button" disabled={pending} onClick={() => setWarning(null)} className={btn.secondary}>修改訊息</button>
          </div>
        </Notice>
      )}
      {error && <div className="mt-2"><ErrorText message={error} /></div>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span id="message-count" className={`text-xs tabular-nums ${over ? "font-bold text-danger" : "text-muted"}`}>
          {count} / {MESSAGE_BODY_MAX}
          {over && <span className="sr-only">，超過字數上限</span>}
          {finePointer && <span className="hidden font-normal text-muted md:inline">・Enter 送出，Shift + Enter 換行</span>}
        </span>
        <button type="submit" disabled={pending || warning !== null || over} className={btn.primary}>
          {pending ? "送出中…" : "送出"}
        </button>
      </div>
    </form>
  );
}
