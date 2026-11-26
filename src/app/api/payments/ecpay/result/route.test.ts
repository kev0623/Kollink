import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const ID = "1a2b3c4d-0000-4000-8000-000000000001";

describe("/api/payments/ecpay/result", () => {
  it("POST：不管內容，303 導回合作案詳情", async () => {
    const body = new URLSearchParams({ RtnCode: "1", MerchantTradeNo: "X" });
    const res = await POST(new Request(`https://kollink.vercel.app/api/payments/ecpay/result?c=${ID}`, { method: "POST", body }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/brand/collabs/${ID}`);
  });
  it("c 不是 uuid：導回合作案列表", async () => {
    const res = await GET(new Request("https://kollink.vercel.app/api/payments/ecpay/result?c=//evil.com"));
    expect(res.headers.get("location")).toBe("/brand/collabs");
  });
});
