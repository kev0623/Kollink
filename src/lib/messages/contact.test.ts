import { describe, expect, it } from "vitest";
import { contactKinds, contactWarning } from "./contact";

// 與 supabase/tests/18_messaging_write.test.sql「B. 聯絡方式偵測」相同的案例；改規則時兩邊一起改。
const POSITIVE = [
  "我的電話 0912-345-678", "０９１２３４５６７８", "+886 912 345 678", "(02) 2345-6789", "07-123-4567",
  "mail: Mei.Lin@Example.com.tw", "看 https://foo.bar/x", "www.abc.xyz", "line.me/ti/p/abc", "官網 abc.com 有",
  "LINE ID: mei_123", "ＬＩＮＥ：mei", "加我賴", "加個line吧", "賴: abc", "line@abc",
  "0912\u00ad345678", "0912_345_678", "0912/345/678", "加😀😀賴",
];
const NEGATIVE = [
  "預算 NT$30,000 元", "2026-11-26 交稿", "deadline: 12/1", "online 直播", "line drawing 風格",
  "abc.comx", "e.g. 這樣", "訂單 123456789", "IG @mei.ig", "09123456789", "加\n\n賴", "2026/11/26 交稿", "12/1 到 12/15",
];

describe("contactKinds", () => {
  it.each(POSITIVE)("偵測得到：%s", (t) => {
    expect(contactKinds(t).length).toBeGreaterThan(0);
  });
  it.each(NEGATIVE)("不會誤判：%s", (t) => {
    expect(contactKinds(t)).toEqual([]);
  });
  it("分出種類", () => {
    expect(contactKinds("0912-345-678")).toEqual(["phone"]);
    expect(contactKinds("a@b.com")).toEqual(["email", "link"]);
    expect(contactKinds("LINE ID: mei")).toEqual(["line"]);
    expect(contactKinds("https://x.y/z")).toEqual(["link"]);
  });
  it("連續呼叫結果一致（不受 global regex 的 lastIndex 影響）", () => {
    expect(contactKinds("0912345678")).toEqual(["phone"]);
    expect(contactKinds("0912345678")).toEqual(["phone"]);
  });
});

describe("contactWarning", () => {
  it("沒有偵測到回傳 null", () => {
    expect(contactWarning([])).toBeNull();
  });
  it("列出種類", () => {
    expect(contactWarning(["phone", "line"])).toContain("可能含有電話、LINE");
  });
});
