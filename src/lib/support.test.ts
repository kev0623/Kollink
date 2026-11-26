import { describe, expect, it } from "vitest";
import { mentionsSupport } from "./support";

describe("mentionsSupport", () => {
  it("提到聯絡平台／客服／我們時為 true", () => {
    expect(mentionsSupport("金額超過線上付款上限，需要由平台協助線下付款，請聯絡平台")).toBe(true);
    expect(mentionsSupport("帳號已暫停，請聯絡客服")).toBe(true);
    expect(mentionsSupport("驗證碼錯誤")).toBe(false);
    expect(mentionsSupport(null)).toBe(false);
  });
});
