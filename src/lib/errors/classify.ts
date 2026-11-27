// 錯誤頁（error.tsx／global-error.tsx）用：把丟出來的值分成使用者能理解的幾種情況。純函式，方便測試。

export type ErrorKind = "offline" | "stale-build" | "generic";

/** 新版本上線後，舊分頁要載入的程式檔已經不存在（各瀏覽器的訊息不同）。 */
const STALE_BUILD_RE = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load chunk/i;

function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === "string" ? error : "";
}

/** online：navigator.onLine（伺服器端或不支援時傳 true）。離線優先：沒網路時其他錯誤多半是它造成的。 */
export function classifyError(error: unknown, online: boolean): ErrorKind {
  if (!online) return "offline";
  if (STALE_BUILD_RE.test(messageOf(error))) return "stale-build";
  return "generic";
}

/** Next 給伺服器端錯誤的識別碼（對照伺服器紀錄用）。只接受短的英數字串，避免把奇怪的內容顯示在畫面上。 */
export function digestOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const d = (error as { digest?: unknown }).digest;
  return typeof d === "string" && /^[\w@:.-]{1,64}$/.test(d) ? d : null;
}

export type ErrorCopy = { title: string; body: string; primary: string };

export const ERROR_COPY: Record<ErrorKind, ErrorCopy> = {
  offline: {
    title: "目前沒有網路連線",
    body: "連上網路後會自動重新載入，你也可以自己再試一次。",
    primary: "再試一次",
  },
  "stale-build": {
    title: "網站剛更新了",
    body: "你開著的是舊版頁面。重新整理就能繼續，已經送出的資料不受影響。",
    primary: "重新整理",
  },
  generic: {
    title: "這一頁暫時打不開",
    body: "已經送出的資料不受影響。再試一次通常就會好；還是不行的話，把下面的代碼告訴我們，我們會查。",
    primary: "再試一次",
  },
};

/** 寄給客服的信件主旨：帶上代碼，客服不用再問。 */
export function supportSubject(digest: string | null): string {
  return digest ? `頁面打不開（代碼 ${digest}）` : "頁面打不開";
}
