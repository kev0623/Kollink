"use client";

import { useId } from "react";
import { Upload } from "lucide-react";

/** 已有圖片時的說明文字：這次選的檔名（沒有就說是目前使用的圖片）。 */
export function uploadedCaption(has: boolean, pickedName: string | null): string | null {
  if (!has) return null;
  return pickedName ? `已上傳：${pickedName}` : "目前使用的圖片";
}

type Props = {
  /** 按鈕文字，例如「選擇圖片」 */
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  /** 上傳中：按鈕文字變「上傳中…」 */
  busy?: boolean;
  /** 目前選好／已上傳的檔名；null 顯示「尚未選擇」 */
  fileName?: string | null;
  describedBy?: string;
  invalid?: boolean;
  /** 螢幕閱讀器用的完整名稱，例如「上傳頭像」 */
  ariaLabel: string;
  onFiles: (files: File[]) => void;
};

/**
 * 自訂外觀的檔案欄位：原生 input 用 sr-only 藏起來但仍可聚焦（鍵盤 Enter／空白鍵開檔案選擇），
 * label 看起來是次要按鈕；聚焦時 label 顯示焦點框。選完立刻清空 value，同一個檔案可以再選一次。
 */
export function FilePicker({ label, accept, multiple, disabled, busy, fileName, describedBy, invalid, ariaLabel, onFiles }: Props) {
  const id = useId();
  const off = disabled || busy;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <label
        htmlFor={id}
        className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-btn border border-line-strong bg-surface px-5 text-sm font-bold text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
          off ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-subtle"
        }`}
      >
        <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
        {busy ? "上傳中…" : label}
        <input
          id={id} type="file" className="sr-only" accept={accept} multiple={multiple} disabled={off}
          aria-label={ariaLabel} aria-describedby={describedBy} aria-invalid={invalid ? true : undefined}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
      <span className="min-w-0 flex-1 truncate text-sm text-muted">{fileName ?? "尚未選擇"}</span>
    </div>
  );
}
