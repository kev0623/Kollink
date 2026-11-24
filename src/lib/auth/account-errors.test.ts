import { describe, expect, it } from "vitest";
import { mapAccountError } from "./account-errors";

describe("mapAccountError", () => {
  it("帳號已存在", () => {
    expect(mapAccountError({ code: "23505", message: "account already exists" })).toEqual({ kind: "exists" });
  });
  it("handle 重複（建立時與更新時）", () => {
    const expected = { kind: "state", state: { fieldErrors: { handle: "這個網址已經有人使用" } } };
    expect(mapAccountError({ code: "23505", message: "handle taken" })).toEqual(expected);
    expect(mapAccountError({
      code: "23505", message: 'duplicate key value violates unique constraint "creator_profiles_handle_key"',
    })).toEqual(expected);
  });
  it("handle 已鎖定", () => {
    expect(mapAccountError({ code: "42501", message: "handle locked after approval" })).toEqual({
      kind: "state", state: { fieldErrors: { handle: "審核通過後不能修改網址" } },
    });
  });
  it("欄位格式錯誤對應到表單欄位", () => {
    expect(mapAccountError({ code: "22023", message: "invalid ig_username" })).toEqual({
      kind: "state", state: { fieldErrors: { igUsername: "格式不正確" } },
    });
    expect(mapAccountError({ code: "22023", message: "invalid logo_path" })).toEqual({
      kind: "state", state: { fieldErrors: { logoPath: "格式不正確" } },
    });
  });
  it("不是品牌或創作者", () => {
    expect(mapAccountError({ code: "42501", message: "not a brand" })).toEqual({
      kind: "state", state: { formError: "這個帳號不是品牌，無法執行此操作" },
    });
    expect(mapAccountError({ code: "42501", message: "not a creator" })).toEqual({
      kind: "state", state: { formError: "這個帳號不是創作者，無法執行此操作" },
    });
  });
  it("原型鏈上的名稱不會被當成欄位", () => {
    expect(mapAccountError({ code: "22023", message: "invalid constructor" })).toEqual({
      kind: "state", state: { formError: "發生錯誤，請稍後再試" },
    });
  });
  it("未登入", () => {
    expect(mapAccountError({ code: "42501", message: "not authenticated" })).toEqual({
      kind: "state", state: { formError: "登入已逾時，請重新登入" },
    });
  });
  it("其他錯誤", () => {
    expect(mapAccountError({ code: "23514", message: "x" })).toEqual({
      kind: "state", state: { formError: "資料格式不正確，請檢查後再送出" },
    });
    expect(mapAccountError({ code: "XX000", message: "boom" })).toEqual({
      kind: "state", state: { formError: "發生錯誤，請稍後再試" },
    });
  });
  it("公開頁欄位錯誤對應到表單欄位", () => {
    const cases: [string, string][] = [
      ["invalid bio", "bio"], ["invalid style_tags", "styleTags"], ["invalid collab_types", "collabTypes"],
      ["invalid engagement_rate", "engagementRate"], ["invalid audience_age", "audienceAge"],
      ["invalid avatar_path", "avatarPath"], ["invalid portfolio", "portfolio"], ["invalid image_path", "portfolio"],
      ["invalid link_url", "portfolio"], ["invalid rates", "rates"], ["invalid collab_type", "rates"],
      ["invalid price_twd", "rates"],
    ];
    for (const [message, field] of cases) {
      expect(mapAccountError({ code: "22023", message })).toEqual({
        kind: "state", state: { fieldErrors: { [field]: "格式不正確" } },
      });
    }
  });
});
