export type ViewMode = "card" | "list";
export const VIEW_MODE_KEY = "kollink:square-view";

type ReadStore = { getItem(key: string): string | null };
type WriteStore = { setItem(key: string, value: string): void };

/** 讀不到（沒有 storage、無痕模式丟錯、值不認得）一律是卡片。 */
export function readViewMode(store: ReadStore | null): ViewMode {
  try {
    return store?.getItem(VIEW_MODE_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

export function writeViewMode(store: WriteStore | null, mode: ViewMode): void {
  try {
    store?.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // 無痕模式或停用儲存空間：忽略，這次瀏覽由呼叫端記在記憶體
  }
}
