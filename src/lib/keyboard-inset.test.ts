import { describe, expect, it } from "vitest";
import { keyboardInset, KEYBOARD_MIN_INSET, NO_KEYBOARD, panelMaxHeight } from "./keyboard-inset";

describe("keyboardInset", () => {
  it("沒有鍵盤：可視高度等於版面高度", () => {
    expect(keyboardInset({ layoutHeight: 800, visualHeight: 800, offsetTop: 0 })).toEqual({ open: false, bottom: 0, visible: 800 });
  });
  it("網址列收合這種小變化不算鍵盤", () => {
    const k = keyboardInset({ layoutHeight: 800, visualHeight: 800 - (KEYBOARD_MIN_INSET - 1), offsetTop: 0 });
    expect(k.open).toBe(false);
    expect(k.bottom).toBe(0);
  });
  it("iOS：版面高度不變、可視高度變小", () => {
    expect(keyboardInset({ layoutHeight: 844, visualHeight: 508, offsetTop: 0 })).toEqual({ open: true, bottom: 336, visible: 508 });
  });
  it("iOS 把頁面往上推（offsetTop）時，底部被蓋住的高度要扣掉", () => {
    expect(keyboardInset({ layoutHeight: 844, visualHeight: 508, offsetTop: 100 })).toEqual({ open: true, bottom: 236, visible: 508 });
  });
  it("不會算出負數，也不會有小數", () => {
    expect(keyboardInset({ layoutHeight: 500, visualHeight: 800, offsetTop: 0 })).toEqual({ open: false, bottom: 0, visible: 800 });
    expect(keyboardInset({ layoutHeight: 844.4, visualHeight: 508.6, offsetTop: 0 }).bottom).toBe(336);
  });
});

describe("panelMaxHeight", () => {
  it("鍵盤沒開：交給 CSS", () => {
    expect(panelMaxHeight(NO_KEYBOARD)).toBeNull();
    expect(panelMaxHeight({ open: false, bottom: 0, visible: 800 })).toBeNull();
  });
  it("鍵盤開著：看得到的高度減掉上方留白", () => {
    expect(panelMaxHeight({ open: true, bottom: 336, visible: 508 })).toBe(492);
    expect(panelMaxHeight({ open: true, bottom: 336, visible: 508 }, 40)).toBe(468);
  });
  it("橫向等極矮的畫面至少留一個可操作的高度", () => {
    expect(panelMaxHeight({ open: true, bottom: 250, visible: 140 })).toBe(200);
  });
});
