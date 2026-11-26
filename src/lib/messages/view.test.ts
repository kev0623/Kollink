import { describe, expect, it } from "vitest";
import {
  closedNotice, counterpartOf, listTimeLabel, mergeMessages, messagesHref, messageTime, previewText,
  toConversation, toConversationListItem, toMessage, unreadBadgeText, withDaySeparators, type Message,
} from "./view";

const msg = (id: string, createdAt: string, body = id): Message => ({ id, senderId: "u", body, flagged: false, createdAt });

describe("列表", () => {
  it("toConversationListItem：null 欄位有預設值", () => {
    const it0 = toConversationListItem({
      id: "c1", my_side: "brand", counterpart_name: null, counterpart_image_path: null, counterpart_handle: "mei",
      last_body: null, last_sender_is_me: null, last_at: null, unread_count: null, closed: null,
    });
    expect(it0).toEqual({
      id: "c1", side: "brand", counterpartName: "", counterpartImagePath: null, counterpartHandle: "mei",
      lastBody: null, lastSenderIsMe: false, lastAt: "", unread: 0, closed: false,
    });
  });
  it("previewText：換行變空白、最多 40 字、自己送的加「你：」", () => {
    expect(previewText({ lastBody: null, lastSenderIsMe: false })).toBe("還沒有訊息");
    expect(previewText({ lastBody: "第一行\n第二行", lastSenderIsMe: true })).toBe("你：第一行 第二行");
    expect(previewText({ lastBody: "字".repeat(41), lastSenderIsMe: false })).toBe(`${"字".repeat(40)}…`);
  });
  it("listTimeLabel：台灣今天顯示時間，其他天顯示日期", () => {
    // 2026-11-26T01:05:00Z = 台灣 11/26 09:05
    expect(listTimeLabel("2026-11-26T01:05:00Z", "2026-11-26")).toBe("09:05");
    expect(listTimeLabel("2026-11-25T15:59:00Z", "2026-11-26")).toBe("11/25");
    expect(listTimeLabel("2026-11-25T16:00:00Z", "2026-11-26")).toBe("00:00");
    expect(listTimeLabel("壞掉", "2026-11-26")).toBe("");
  });
  it("unreadBadgeText", () => {
    expect(unreadBadgeText(0)).toBeNull();
    expect(unreadBadgeText(-1)).toBeNull();
    expect(unreadBadgeText(3)).toBe("3");
    expect(unreadBadgeText(10)).toBe("9+");
  });
  it("messagesHref", () => {
    expect(messagesHref("brand")).toBe("/brand/messages");
    expect(messagesHref("creator", "c1")).toBe("/creator/messages/c1");
  });
});

describe("對話", () => {
  const c = toConversation({
    id: "c1", my_side: "x", brand_id: "b", brand_name: "花粉", brand_logo_path: "b/logo.png", creator_id: "u",
    creator_name: "小美", creator_handle: "mei", creator_avatar_path: null, closed: true,
  });
  it("toConversation：my_side 不是 brand／creator 就是 admin", () => {
    expect(c).toMatchObject({ side: "admin", brandName: "花粉", creatorHandle: "mei", closed: true });
  });
  it("counterpartOf：品牌看到創作者、創作者看到品牌", () => {
    expect(counterpartOf(c, "brand")).toEqual({ name: "小美", imagePath: null, handle: "mei" });
    expect(counterpartOf(c, "creator")).toEqual({ name: "花粉", imagePath: "b/logo.png", handle: null });
  });
  it("closedNotice", () => {
    expect(closedNotice("brand")).toContain("停權");
    expect(closedNotice("creator")).toContain("你的帳號");
  });
});

describe("訊息", () => {
  it("toMessage", () => {
    expect(toMessage({ id: "m1", sender_id: null, body: null, flagged_contact: true, created_at: null }))
      .toEqual({ id: "m1", senderId: "", body: "", flagged: true, createdAt: "" });
  });
  it("mergeMessages：依 id 去重、依時間再依 id 由舊到新", () => {
    const a = [msg("b", "2026-11-26T01:00:00Z"), msg("c", "2026-11-26T02:00:00Z")];
    const b = [msg("c", "2026-11-26T02:00:00Z", "新版"), msg("a", "2026-11-26T01:00:00Z"), msg("d", "2026-11-26T00:00:00Z")];
    const out = mergeMessages(a, b);
    expect(out.map((m) => m.id)).toEqual(["d", "a", "b", "c"]);
    expect(out[3].body).toBe("新版");
  });
  it("messageTime：台灣時間", () => {
    expect(messageTime("2026-11-26T01:05:00Z")).toBe("09:05");
    expect(messageTime("")).toBe("");
  });
  it("withDaySeparators：台灣日期改變時插入分隔線", () => {
    const out = withDaySeparators([
      msg("a", "2026-11-25T15:00:00Z"), // 台灣 11/25 23:00
      msg("b", "2026-11-25T16:30:00Z"), // 台灣 11/26 00:30
      msg("c", "2026-11-26T01:00:00Z"),
    ]);
    expect(out.map((e) => (e.kind === "day" ? e.label : e.key))).toEqual(["2026/11/25", "a", "2026/11/26", "b", "c"]);
  });
});
