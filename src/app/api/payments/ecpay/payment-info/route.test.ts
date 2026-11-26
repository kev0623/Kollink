import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeCheckMacValue } from "@/lib/payments/ecpay";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { POST } from "./route";

const KEY = "pwFHCqoQZGmho4w6";
const IV = "EkRm7iFT261dpevs";

function info(overrides: Record<string, string> = {}): Request {
  const params: Record<string, string> = {
    MerchantID: "3002607", MerchantTradeNo: "KL2611270123456789AB", RtnCode: "2", RtnMsg: "Get VirtualAccount Succeeded",
    TradeNo: "2611271200001234", TradeAmt: "4500", PaymentType: "ATM_TAISHIN", TradeDate: "2026/11/27 12:00:00",
    BankCode: "812", vAccount: "9103522850123456", ExpireDate: "2026/11/30", StoreID: "",
    ...overrides,
  };
  const body = new URLSearchParams({ ...params, CheckMacValue: computeCheckMacValue(params, KEY, IV) });
  return new Request("https://kollink.vercel.app/api/payments/ecpay/payment-info", {
    method: "POST", body,
    headers: { "content-type": "application/x-www-form-urlencoded", "content-length": String(body.toString().length) },
  });
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "recorded", error: null });
  vi.stubEnv("ECPAY_ENV", "stage");
  vi.stubEnv("ECPAY_MERCHANT_ID", "3002607");
  vi.stubEnv("ECPAY_HASH_KEY", KEY);
  vi.stubEnv("ECPAY_HASH_IV", IV);
  vi.stubEnv("SITE_URL", "https://kollink.vercel.app");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/payments/ecpay/payment-info", () => {
  it("取號成功：呼叫 record_payment_info，回 1|OK", async () => {
    const res = await POST(info());
    expect(await res.text()).toBe("1|OK");
    expect(rpc).toHaveBeenCalledWith("record_payment_info", expect.objectContaining({
      p_merchant_trade_no: "KL2611270123456789AB", p_bank_code: "812", p_v_account: "9103522850123456",
      p_expire_date: "2026-11-30", p_amount_twd: 4500,
    }));
  });
  it("取號失敗（RtnCode 不是 2）：1|OK、不記錄", async () => {
    const res = await POST(info({ RtnCode: "0" }));
    expect(await res.text()).toBe("1|OK");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("content-type 不是表單：400，不碰資料庫", async () => {
    const body = "MerchantID=3002607";
    const res = await POST(new Request("https://kollink.vercel.app/x", {
      method: "POST", body, headers: { "content-type": "application/json", "content-length": String(body.length) },
    }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("缺 content-length 或超過 64 KB：400，不碰資料庫", async () => {
    const body = "MerchantID=3002607";
    const noLength = await POST(new Request("https://kollink.vercel.app/x", {
      method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" },
    }));
    expect(noLength.status).toBe(400);
    const tooBig = await POST(new Request("https://kollink.vercel.app/x", {
      method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "content-length": "65537" },
    }));
    expect(tooBig.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("沒設定：500", async () => {
    vi.stubEnv("ECPAY_ENV", "");
    expect((await POST(info())).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("資料庫錯誤：500", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid payment info" } });
    expect((await POST(info())).status).toBe(500);
  });
  it("Vercel 正式環境用測試金鑰（視為未設定）：500，不碰資料庫", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await POST(info());
    expect(res.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
});
