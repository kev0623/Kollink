import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, revalidatePath } = vi.hoisted(() => ({ requireRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { requestReviewAction } from "../actions";
import { savePayoutAccountAction } from "./actions";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: "creator-1" });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  revalidatePath.mockReset();
});

describe("savePayoutAccountAction", () => {
  it("只給創作者；格式錯誤不碰資料庫", async () => {
    expect(await savePayoutAccountAction({}, form({ bankCode: "8", accountNumber: "1", accountName: "x" })))
      .toMatchObject({ fieldErrors: { bankCode: expect.any(String), accountNumber: expect.any(String) } });
    expect(requireRole).toHaveBeenCalledWith("creator");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("成功：送清理過的值", async () => {
    expect(await savePayoutAccountAction({}, form({ bankCode: "812", branchCode: "", accountNumber: "1234-5678 9012", accountName: " 王小美 " })))
      .toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_my_payout_account", {
      p_bank_code: "812", p_branch_code: "", p_account_number: "123456789012", p_account_name: "王小美",
    });
  });
  it("資料庫的欄位錯誤對應到欄位", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "invalid account_name" } });
    expect(await savePayoutAccountAction({}, form({ bankCode: "812", accountNumber: "12345678", accountName: "x" })))
      .toEqual({ fieldErrors: { accountName: "格式不正確" } });
  });
});

describe("requestReviewAction", () => {
  it("成功；狀態已變時提示重新整理", async () => {
    expect(await requestReviewAction()).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("request_creator_review");
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "creator status changed" } });
    expect(await requestReviewAction()).toEqual({ ok: false, error: "狀態已經更新，請重新整理" });
  });
});
