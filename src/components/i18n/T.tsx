import type { L } from "@/lib/lang";

/**
 * 一段雙語文字：兩種語言都輸出，CSS（globals.css 的 [data-l]）依 <html data-lang> 只顯示一種。
 * server 與 client 元件都能用；沒有 JavaScript 時顯示中文。
 * 只能用在可以放 <span> 的地方（屬性、<option>、<title> 用 useLang）。
 */
export function T({ zh, en }: L) {
  return (
    <>
      <span data-l="zh">{zh}</span>
      <span data-l="en" lang="en">{en}</span>
    </>
  );
}

/** 用頓號（中文）或逗號（英文）串起來的清單，例如類別。 */
export function TList({ items }: { items: L[] }) {
  return <T zh={items.map((i) => i.zh).join("・")} en={items.map((i) => i.en).join(", ")} />;
}
