import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { GET } from "./route";

function req(auth?: string): Request {
  return new Request("http://localhost/api/cron/auto-approve", { headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  rpc.mockReset();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/auto-approve", () => {
  it("沒帶或帶錯 secret 回 401，不碰資料庫", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("CRON_SECRET 沒設定回 500", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("帶對 secret：以 service_role 呼叫 auto_approve_due 並回傳件數", async () => {
    rpc.mockResolvedValue({ data: [{ approved: 2, failed: ["c9"] }], error: null });
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ approved: 2, failed: ["c9"] });
    expect(rpc).toHaveBeenCalledWith("auto_approve_due");
    expect(console.error).toHaveBeenCalledWith("cron auto-approve: some collaborations failed", { failed: ["c9"] });
  });
  it("資料庫錯誤回 500", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    expect((await GET(req("Bearer test-secret"))).status).toBe(500);
  });
});
