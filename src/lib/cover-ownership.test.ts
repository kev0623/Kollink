import { describe, expect, it, vi } from "vitest";
import { createCoverOwnership } from "./cover-ownership";

describe("createCoverOwnership", () => {
  it("replaces an unsaved upload by deleting the previous one", () => {
    const remove = vi.fn();
    const o = createCoverOwnership(remove);
    o.adopt("u/a.png");
    o.adopt("u/b.png");
    expect(remove).toHaveBeenCalledExactlyOnceWith("u/a.png");
  });

  it("does not remove a cover after it was saved in place (replace)", () => {
    const remove = vi.fn();
    const o = createCoverOwnership(remove);
    o.adopt("u/a.png");
    o.markPersisted();
    o.adopt("u/b.png");
    expect(remove).not.toHaveBeenCalled();
  });

  it("does not remove a saved cover on 移除封面", () => {
    const remove = vi.fn();
    const o = createCoverOwnership(remove);
    o.adopt("u/a.png");
    o.markPersisted();
    o.discard("u/a.png");
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes an unsaved upload on 移除封面 and never a foreign path", () => {
    const remove = vi.fn();
    const o = createCoverOwnership(remove);
    o.discard("u/db.png");
    o.adopt("u/a.png");
    o.discard("u/a.png");
    expect(remove).toHaveBeenCalledExactlyOnceWith("u/a.png");
  });
});
