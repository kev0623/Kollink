import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, revalidatePath } = vi.hoisted(() => ({ requireRole: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/current-user", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

import { creatorCollabAction, publishCollabAction, submitDeliverablesAction } from "./actions";

const UID = "00000000-0000-0000-0000-000000000731";
const COLLAB = "00000000-0000-0000-0000-0000000007d1";
const FILE = `${COLLAB}/${UID}/11111111-1111-4111-8111-111111111111.jpg`;

beforeEach(() => {
  requireRole.mockReset().mockResolvedValue({ id: UID });
  rpc.mockReset();
  revalidatePath.mockReset();
});

describe("creatorCollabAction", () => {
  it("只接受接受與婉拒", async () => {
    expect(await creatorCollabAction(COLLAB, "submit")).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: "awaiting_payment", error: null });
    expect(await creatorCollabAction(COLLAB, "accept")).toEqual({ ok: true });
    expect(requireRole).toHaveBeenCalledWith("creator");
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", { p_collab_id: COLLAB, p_action: "accept" });
  });
});

describe("submitDeliverablesAction", () => {
  it("參數形狀不對不碰資料庫", async () => {
    expect(await submitDeliverablesAction(COLLAB, null)).toMatchObject({ ok: false });
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: "x", filePaths: [] })).toMatchObject({ ok: false });
    expect(await submitDeliverablesAction("x", { note: "", links: [], filePaths: [] })).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("檔案必須在自己的資料夾；至少一項", async () => {
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: [], filePaths: [] }))
      .toEqual({ ok: false, fieldErrors: { files: "請上傳檔案或附上連結" } });
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: [], filePaths: [`${COLLAB}/someone/x.jpg`] }))
      .toEqual({ ok: false, fieldErrors: { files: "檔案資料不正確，請重新上傳" } });
  });
  it("清理後送出", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    expect(await submitDeliverablesAction(COLLAB, { note: " 初稿\r\n ", links: [" https://drive.google.com/x ", " "], filePaths: [FILE] }))
      .toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_deliverables", {
      p_collab_id: COLLAB, p_note: "初稿", p_links: ["https://drive.google.com/x"], p_file_paths: [FILE],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/brand/collabs/${COLLAB}`);
  });
  it("狀態已變", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "collaboration not awaiting submission" } });
    expect(await submitDeliverablesAction(COLLAB, { note: "", links: [], filePaths: [FILE] }))
      .toEqual({ ok: false, error: "合作案的狀態已經更新" });
  });
});

describe("publishCollabAction", () => {
  it("網址先在伺服器檢查", async () => {
    expect(await publishCollabAction(COLLAB, "https://a..b.com/p/1"))
      .toEqual({ ok: false, error: "請貼上完整的貼文網址（https:// 開頭、含路徑）" });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: "awaiting_payout", error: null });
    expect(await publishCollabAction(COLLAB, " https://www.instagram.com/p/abc/ ")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("transition_collaboration", {
      p_collab_id: COLLAB, p_action: "publish", p_published_url: "https://www.instagram.com/p/abc/",
    });
  });
});
