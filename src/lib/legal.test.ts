import { describe, expect, it } from "vitest";
import { authPageRedirect, requiresAuth } from "@/lib/auth/routes";
import { PRIVACY_PAGE, TERMS_PAGE } from "@/lib/site";

// 服務條款與隱私權政策必須不用登入就看得到（Google 同意畫面、LINE Email 權限申請都會連過來），
// 已登入的人也不能被 proxy 導走。
describe("服務條款／隱私權政策是公開頁", () => {
  it.each([TERMS_PAGE, PRIVACY_PAGE])("%s 不需要登入", (path) => {
    expect(requiresAuth(path)).toBe(false);
  });

  it.each([TERMS_PAGE, PRIVACY_PAGE])("%s 不會把已登入者導走", (path) => {
    expect(authPageRedirect(path, new URLSearchParams())).toBeNull();
  });

  it("路徑固定是 /terms 與 /privacy（README 與外部設定都用這兩個網址）", () => {
    expect(TERMS_PAGE).toBe("/terms");
    expect(PRIVACY_PAGE).toBe("/privacy");
  });
});
