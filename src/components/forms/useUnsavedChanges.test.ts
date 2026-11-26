import { describe, expect, it } from "vitest";
import { internalNavTarget } from "./useUnsavedChanges";

const here = { origin: "https://kollink.test", pathname: "/creator/me", search: "" };
const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

describe("internalNavTarget", () => {
  it("站內連結回傳路徑", () => {
    expect(internalNavTarget({ href: "https://kollink.test/creator/collabs?x=1#a" }, click, here)).toBe("/creator/collabs?x=1#a");
  });
  it("同頁與 #錨點不攔", () => {
    expect(internalNavTarget({ href: "https://kollink.test/creator/me#rates" }, click, here)).toBeNull();
  });
  it("站外、新分頁、下載、修飾鍵、右鍵都不攔", () => {
    expect(internalNavTarget({ href: "https://example.com/" }, click, here)).toBeNull();
    expect(internalNavTarget({ href: "/x", target: "_blank" }, click, here)).toBeNull();
    expect(internalNavTarget({ href: "/x", download: "a.pdf" }, click, here)).toBeNull();
    expect(internalNavTarget({ href: "/x" }, { ...click, metaKey: true }, here)).toBeNull();
    expect(internalNavTarget({ href: "/x" }, { ...click, button: 2 }, here)).toBeNull();
    expect(internalNavTarget({ href: "/x" }, { ...click, defaultPrevented: true }, here)).toBeNull();
  });
});
