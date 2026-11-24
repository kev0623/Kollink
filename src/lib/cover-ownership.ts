/**
 * 追蹤「這次畫面上傳、還沒存進資料庫」的封面路徑。只有這種檔案可以在被換掉或移除時刪除；
 * 已存進資料庫的封面（初始值、或存成草稿成功之後）一律不刪。
 */
export function createCoverOwnership(remove: (path: string) => void) {
  let owned: string | null = null;
  return {
    /** 新上傳成功：先刪掉上一個自己上傳且尚未儲存的檔案，再接手新的。 */
    adopt(path: string) {
      if (owned) remove(owned);
      owned = path;
    },
    /** 封面被換掉或移除：只有自己上傳且尚未儲存的才刪。 */
    discard(path: string | null) {
      if (!path || path !== owned) return;
      owned = null;
      remove(path);
    },
    /** 儲存成功：目前路徑已存進資料庫，不再屬於這次上傳。 */
    markPersisted() {
      owned = null;
    },
  };
}
