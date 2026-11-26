import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeCheckMacValue } from "@/lib/payments/ecpay";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { POST } from "./route";

const KEY = "pwFHCqoQZGmho4w6";
const IV = "EkRm7iFT261dpevs";

function notify(overrides: Record<string, string> = {}, key = KEY): Request {
  const params: Record<string, string> = {
    MerchantID: "3002607", MerchantTradeNo: "KL2611270123456789AB", RtnCode: "1", RtnMsg: "交易成功",
    TradeNo: "2611271200001234", TradeAmt: "4500", PaymentDate: "2026/11/27 12:01:00",
    PaymentType: "Credit_CreditCard", PaymentTypeChargeFee: "113", TradeDate: "2026/11/27 12:00:00",
    SimulatePaid: "0", StoreID: "", CustomField1: "", CustomField2: "", CustomField3: "", CustomField4: "",
    ...overrides,
  };
  const body = new URLSearchParams({ ...params, CheckMacValue: computeCheckMacValue(params, key, IV) });
  return new Request("https://kollink.vercel.app/api/payments/ecpay/notify", {
    method: "POST", body,
    headers: { "content-type": "application/x-www-form-urlencoded", "content-length": String(body.toString().length) },
  });
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "paid", error: null });
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

describe("POST /api/payments/ecpay/notify", () => {
  it("驗簽通過：以 service_role 呼叫 record_payment_success（帶環境、白名單欄位），回 1|OK", async () => {
    const res = await POST(notify({ card4no: "2222" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1|OK");
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(rpc).toHaveBeenCalledWith("record_payment_success", expect.objectContaining({
      p_merchant_trade_no: "KL2611270123456789AB", p_amount_twd: 4500, p_provider_trade_no: "2611271200001234", p_env: "stage",
    }));
    const raw = rpc.mock.calls[0][1].p_raw;
    expect(raw).not.toHaveProperty("card4no");
    expect(raw).not.toHaveProperty("CheckMacValue");
  });
  it("環境變數不齊：500，不碰資料庫", async () => {
    vi.stubEnv("ECPAY_HASH_IV", "");
    const res = await POST(notify());
    expect(res.status).toBe(500);
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
  it("簽章錯誤：400", async () => {
    const res = await POST(notify({}, "wrongkey12345678"));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("0|CheckMacValue Error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("不是表單：400", async () => {
    const res = await POST(new Request("https://kollink.vercel.app/api/payments/ecpay/notify", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });
  it("資料庫記錄異常（anomaly）：仍回 1|OK", async () => {
    rpc.mockResolvedValue({ data: "anomaly", error: null });
    const res = await POST(notify());
    expect(await res.text()).toBe("1|OK");
  });
  it("資料庫錯誤：500（讓綠界重送）", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const res = await POST(notify());
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("0|Error");
  });
  it("不認得的回傳值：500", async () => {
    rpc.mockResolvedValue({ data: "weird", error: null });
    expect((await POST(notify())).status).toBe(500);
  });
  it("正式環境的模擬付款：1|OK 但不記錄", async () => {
    vi.stubEnv("ECPAY_ENV", "prod");
    vi.stubEnv("ECPAY_MERCHANT_ID", "1234567");
    vi.stubEnv("ECPAY_HASH_KEY", "realProdKey12345");
    const res = await POST(notify({ MerchantID: "1234567", SimulatePaid: "1" }, "realProdKey12345"));
    expect(await res.text()).toBe("1|OK");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("Vercel 正式環境用測試金鑰（視為未設定）：500，不碰資料庫", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await POST(notify());
    expect(res.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
});
