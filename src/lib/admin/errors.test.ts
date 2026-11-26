import { describe, expect, it } from "vitest";
import { isStaleStateMessage } from "@/lib/briefs/errors";
import { COLLAB_STALE_MESSAGE } from "@/lib/collabs/errors";
import { ADMIN_STALE_MESSAGE, adminErrorMessage, paymentResultNotice } from "./errors";

describe("adminErrorMessage", () => {
  it("已知錯誤轉中文；不認得的回通用訊息", () => {
    expect(adminErrorMessage({ message: "test payment cannot be paid out" })).toContain("測試環境");
    expect(adminErrorMessage({ message: "payout account missing" })).toBe("創作者還沒填收款帳戶，請先聯絡創作者");
    expect(adminErrorMessage({ message: "admin is participant" })).toContain("參與者");
    expect(adminErrorMessage({ message: "toString" })).toBe("發生錯誤，請稍後再試");
    expect(adminErrorMessage({})).toBe("發生錯誤，請稍後再試");
  });
  it("狀態已經變了：當成重新整理，不是錯誤", () => {
    expect(adminErrorMessage({ message: "creator status changed" })).toBe(ADMIN_STALE_MESSAGE);
    expect(adminErrorMessage({ message: "collaboration not awaiting payout" })).toBe(COLLAB_STALE_MESSAGE);
    expect(adminErrorMessage({ message: "invalid transition: payout from completed by admin" })).toBe(COLLAB_STALE_MESSAGE);
    expect(isStaleStateMessage(ADMIN_STALE_MESSAGE)).toBe(true);
  });
});

describe("paymentResultNotice", () => {
  it("paid 不另外提示；anomaly 不算成功", () => {
    expect(paymentResultNotice("paid")).toEqual({ ok: true, notice: null });
    expect(paymentResultNotice("already_paid").ok).toBe(true);
    expect(paymentResultNotice("paid_refund_required")).toMatchObject({ ok: true });
    expect(paymentResultNotice("anomaly")).toMatchObject({ ok: false });
    expect(paymentResultNotice(null)).toMatchObject({ ok: false });
  });
});
