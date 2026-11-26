import { describe, expect, it } from "vitest";
import {
  actionCardCopy, caseCode, COLLAB_STEPS, escrowLabel, eventText, eventTime, listBadge, parseCollabTab,
  reviewCountdown, revisionNotesByRound, stepNumber, stepStates, toCollab, toCollabEvent, toCollabListItem,
  toCollabStatus, toSubmission, turnOf, type CollabEvent, type CollabStatus, type Submission,
} from "./view";

const ALL: CollabStatus[] = [
  "invited", "awaiting_payment", "awaiting_submission", "in_review",
  "awaiting_publish", "awaiting_payout", "completed", "declined", "cancelled",
];

describe("狀態", () => {
  it("不認得的狀態當成已取消", () => {
    expect(toCollabStatus("in_review")).toBe("in_review");
    expect(toCollabStatus("bogus")).toBe("cancelled");
    expect(toCollabStatus(null)).toBe("cancelled");
  });
  it("輪到誰（與 SQL collab_turn 同一張表）", () => {
    expect(ALL.map(turnOf)).toEqual([
      "creator", "brand", "creator", "brand", "creator", "platform", null, null, null,
    ]);
  });
});

describe("進度條", () => {
  it("7 步", () => expect(COLLAB_STEPS).toHaveLength(7));
  it("待付款：邀約已完成、確認是目前步驟", () => {
    expect(stepStates("awaiting_payment")).toEqual(["done", "current", "todo", "todo", "todo", "todo", "todo"]);
    expect(stepNumber("awaiting_payment")).toBe(2);
  });
  it("待交稿：付款託管已完成", () => {
    expect(stepStates("awaiting_submission")).toEqual(["done", "done", "done", "current", "todo", "todo", "todo"]);
    expect(stepNumber("awaiting_submission")).toBe(4);
  });
  it("撥款中是第 7 步；已完成全部完成", () => {
    expect(stepNumber("awaiting_payout")).toBe(7);
    expect(stepStates("completed")).toEqual(Array(7).fill("done"));
    expect(stepNumber("completed")).toBe(7);
  });
  it("婉拒與取消沒有進度條", () => {
    expect(stepStates("declined")).toBeNull();
    expect(stepNumber("cancelled")).toBeNull();
  });
});

describe("金額與案號", () => {
  it("託管文字", () => {
    expect(escrowLabel("awaiting_payment", 4500)).toBe("NT$4,500 待付款");
    expect(escrowLabel("in_review", 4500)).toBe("NT$4,500 已託管");
    expect(escrowLabel("completed", 4500)).toBe("NT$4,500 已撥款");
    expect(escrowLabel("cancelled", 4500)).toBe("NT$4,500 未成立");
  });
  it("案號是 id 前 8 碼", () => {
    expect(caseCode("1a2b3c4d-0000-0000-0000-000000000000")).toBe("1a2b3c4d");
  });
});

describe("列表", () => {
  it("分頁：垃圾值當成進行中", () => {
    expect(parseCollabTab(undefined)).toBe("active");
    expect(parseCollabTab("completed")).toBe("completed");
    expect(parseCollabTab(["cancelled", "x"])).toBe("cancelled");
    expect(parseCollabTab("drop table")).toBe("active");
  });
  it("輪到你／等對方／撥款處理中", () => {
    expect(listBadge("in_review", "brand")).toEqual({ label: "輪到你", tone: "turn" });
    expect(listBadge("in_review", "creator")).toEqual({ label: "等對方", tone: "wait" });
    expect(listBadge("awaiting_payout", "brand")).toEqual({ label: "撥款處理中", tone: "platform" });
    expect(listBadge("completed", "brand")).toBeNull();
  });
  it("Row 的 null 都有預設值", () => {
    expect(toCollabListItem({
      id: "c1", title: null, amount_twd: null, status: null, updated_at: null, my_side: "creator",
      counterpart_name: null, counterpart_image_path: null, counterpart_handle: null, my_turn: null,
    })).toEqual({
      id: "c1", title: "", amount: 0, status: "cancelled", updatedAt: "", side: "creator",
      counterpartName: "", counterpartImagePath: null, counterpartHandle: null, myTurn: false,
    });
  });
});

describe("詳情", () => {
  it("toCollab：my_side 不是 brand／creator 就是 admin", () => {
    const c = toCollab({
      id: "c1", title: "案", deliverables: null, amount_twd: 4500, status: "in_review", review_due_at: null,
      published_url: null, created_at: null, updated_at: null, brief_id: null, brief_title: null, my_side: "x",
      brand_id: null, brand_name: null, brand_logo_path: null, creator_id: null, creator_name: null,
      creator_handle: null, creator_avatar_path: null,
    });
    expect(c).toMatchObject({ title: "案", deliverables: "", amount: 4500, status: "in_review", side: "admin", conversationId: null });
  });
  it("卡片：輪到對方時一定寫你不用做任何事", () => {
    for (const s of ALL) {
      for (const side of ["brand", "creator"] as const) {
        const copy = actionCardCopy(s, side);
        if (turnOf(s) !== null && !copy.mine) expect(copy.body).toContain("你不用做任何事");
      }
    }
    expect(actionCardCopy("in_review", "brand")).toMatchObject({ mine: true, title: "輪到你：審核交稿" });
    expect(actionCardCopy("in_review", "creator")).toMatchObject({ mine: false, title: "等對方審核" });
    expect(actionCardCopy("awaiting_payment", "brand").body).toContain("信用卡或 ATM 轉帳");
  });
  it("審核倒數", () => {
    const now = Date.parse("2026-11-25T00:00:00Z");
    expect(reviewCountdown(null, now)).toBeNull();
    expect(reviewCountdown("2026-11-27T05:30:00Z", now)).toBe("剩 2 天 05 小時後自動通過");
    expect(reviewCountdown("2026-11-25T23:00:00Z", now)).toBe("剩 0 天 23 小時後自動通過");
    expect(reviewCountdown("2026-11-25T00:30:00Z", now)).toBe("不到 1 小時後自動通過");
    expect(reviewCountdown("2026-11-25T00:00:00Z", now)).toBe("即將自動通過");
    expect(reviewCountdown("not a date", now)).toBeNull();
  });
});

describe("交稿與事件", () => {
  const ev = (o: Partial<CollabEvent>): CollabEvent => ({
    id: 1, action: "submit", actorKind: "creator", actorName: "小美", toStatus: null, note: null, createdAt: "2026-11-25T03:00:00Z", ...o,
  });
  it("事件文字", () => {
    expect(eventText(ev({ action: "create", actorKind: "brand", actorName: "花粉", toStatus: "invited" }))).toBe("花粉 發出邀約");
    expect(eventText(ev({ action: "create", actorKind: "brand", actorName: "花粉", toStatus: "awaiting_payment" }))).toBe("花粉 錄取並建立合作案");
    expect(eventText(ev({ action: "submit" }))).toBe("小美 已交稿");
    expect(eventText(ev({ action: "request_changes", actorName: "花粉", note: "亮一點" }))).toBe("花粉 要求修改：亮一點");
    expect(eventText(ev({ action: "mark_paid", actorKind: "system", actorName: "系統" }))).toBe("款項已託管");
    expect(eventText(ev({ action: "auto_approve" }))).toBe("審核期限已到，自動通過");
    expect(eventText(ev({ action: "payment_requires_refund", actorKind: "system" }))).toBe("收到一筆額外的付款，平台會處理退款");
    expect(eventText(ev({ action: "payment_refunded", actorKind: "admin" }))).toBe("平台已退回一筆額外的付款");
    expect(eventText(ev({ action: "payment_anomaly", actorKind: "system" }))).toBe("平台正在確認一筆付款");
    expect(eventText(ev({ action: "weird" }))).toBe("小美：狀態已更新");
    expect(eventText(ev({ action: "weird", actorName: "" }))).toBe("狀態已更新");
  });
  it("事件時間是台灣時間 MM/DD HH:mm", () => {
    expect(eventTime("2026-11-25T03:05:00Z")).toBe("11/25 11:05");
    expect(eventTime("bad")).toBe("");
  });
  it("Row → 物件", () => {
    expect(toCollabEvent({
      id: "7", action: "approve", actor_kind: null, actor_name: null, from_status: null, to_status: null, note: null, created_at: null,
    })).toEqual({ id: 7, action: "approve", actorKind: "system", actorName: "系統", toStatus: null, note: null, createdAt: "" });
    expect(toSubmission({ id: "s1", round: 2, note: null, links: null, file_paths: null, created_at: "t" }))
      .toEqual({ id: "s1", round: 2, note: null, links: [], filePaths: [], createdAt: "t" });
  });
  it("修改說明掛在對應的那一輪", () => {
    const subs: Submission[] = [
      { id: "s1", round: 1, note: null, links: [], filePaths: [], createdAt: "2026-11-25T01:00:00Z" },
      { id: "s2", round: 2, note: null, links: [], filePaths: [], createdAt: "2026-11-25T05:00:00Z" },
    ];
    const events = [
      ev({ action: "request_changes", note: "第一輪的意見", createdAt: "2026-11-25T02:00:00Z" }),
      ev({ action: "request_changes", note: "第二輪的意見", createdAt: "2026-11-25T06:00:00Z" }),
      ev({ action: "request_changes", note: "沒有交稿前", createdAt: "2026-11-25T00:00:00Z" }),
      ev({ action: "submit", createdAt: "2026-11-25T07:00:00Z" }),
    ];
    expect(revisionNotesByRound(subs, events)).toEqual({ 1: ["第一輪的意見"], 2: ["第二輪的意見"] });
  });
});

describe("平台取消（計畫 9）", () => {
  const ev = (o: Partial<CollabEvent>): CollabEvent => ({
    id: 1, action: "x", actorKind: "admin", actorName: "平台", toStatus: null, note: null, createdAt: "2026-11-27T00:00:00Z", ...o,
  });
  it("事件文字：原因雙方都看得到；退款排程", () => {
    expect(eventText(ev({ action: "admin_cancel", note: "雙方同意取消" }))).toBe("平台取消合作：雙方同意取消");
    expect(eventText(ev({ action: "refund_scheduled" }))).toBe("平台會退回已託管的款項");
  });
  it("已取消的卡片不再寫「品牌已取消」（也可能是平台取消）", () => {
    expect(actionCardCopy("cancelled", "creator").body).toBe("這個合作案已取消，原因見下方的紀錄。");
  });
});
