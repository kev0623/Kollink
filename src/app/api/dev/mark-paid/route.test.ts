import { beforeEach, describe, expect, it, vi } from "vitest";

const { enabled, userRpc, adminRpc, insert } = vi.hoisted(() => ({
  enabled: vi.fn(), userRpc: vi.fn(), adminRpc: vi.fn(), insert: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dev-login", () => ({ isDevLoginEnabled: enabled }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: userRpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc, from: () => ({ insert }) }) }));

import { POST } from "./route";

const ID = "00000000-0000-0000-0000-0000000007e2";

function req(collabId: string) {
  const body = new FormData();
  body.set("collabId", collabId);
  return new Request("http://localhost/api/dev/mark-paid", { method: "POST", body }) as never;
}

beforeEach(() => {
  enabled.mockReset().mockReturnValue(true);
  userRpc.mockReset();
  adminRpc.mockReset();
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/dev/mark-paid", () => {
  it("非本機開發一律 404", async () => {
    enabled.mockReturnValue(false);
    expect((await POST(req(ID))).status).toBe(404);
    expect(userRpc).not.toHaveBeenCalled();
  });
  it("沒有表單內容或 collabId 不是 uuid：400（不是 500）", async () => {
    expect((await POST(new Request("http://localhost/api/dev/mark-paid", { method: "POST" }) as never)).status).toBe(400);
    expect((await POST(req("x"))).status).toBe(400);
    expect(userRpc).not.toHaveBeenCalled();
  });
  it("不是參與者 404", async () => {
    userRpc.mockResolvedValue({ data: [], error: null });
    expect((await POST(req(ID))).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
  it("建付款單再呼叫 record_payment_success，303 導回詳情", async () => {
    userRpc.mockResolvedValue({ data: [{ status: "awaiting_payment", amount_twd: 4500, my_side: "brand" }], error: null });
    adminRpc.mockResolvedValue({ data: "paid", error: null });
    const res = await POST(req(ID));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/brand/collabs/${ID}`);
    const payment = insert.mock.calls[0][0];
    expect(payment).toMatchObject({ collaboration_id: ID, provider: "ecpay", amount_twd: 4500 });
    expect(payment.merchant_trade_no).toMatch(/^DEV[0-9A-F]{17}$/);
    expect(adminRpc).toHaveBeenCalledWith("record_payment_success", expect.objectContaining({
      p_merchant_trade_no: payment.merchant_trade_no, p_amount_twd: 4500,
    }));
  });
  it("已經不是待付款：不建單，直接導回", async () => {
    userRpc.mockResolvedValue({ data: [{ status: "awaiting_submission", amount_twd: 4500, my_side: "creator" }], error: null });
    const res = await POST(req(ID));
    expect(res.headers.get("location")).toBe(`/creator/collabs/${ID}`);
    expect(insert).not.toHaveBeenCalled();
  });
});
