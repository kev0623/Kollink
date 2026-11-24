import { describe, expect, it } from "vitest";
import { parseBrandForm, parseCreatorForm } from "./form-data";

function fd(entries: [string, string][]) {
  const f = new FormData();
  entries.forEach(([k, v]) => f.append(k, v));
  return f;
}

describe("parseBrandForm", () => {
  it("去空白、空的 Logo 變成 null", () => {
    expect(parseBrandForm(fd([["brandName", " 花粉選物\u3000"], ["industry", "美妝保養"], ["logoPath", " "]]))).toEqual({
      brandName: "花粉選物", industry: "美妝保養", logoPath: null,
    });
  });
  it("缺欄位時為空字串", () => {
    expect(parseBrandForm(fd([]))).toEqual({ brandName: "", industry: "", logoPath: null });
  });
  it("Logo 路徑原樣保留", () => {
    expect(parseBrandForm(fd([["brandName", "x"], ["industry", "美妝保養"], ["logoPath", "u1/a.png"]])).logoPath).toBe("u1/a.png");
  });
});

describe("parseCreatorForm", () => {
  it("IG 去掉 @、內容領域取多個值", () => {
    expect(parseCreatorForm(fd([
      ["displayName", " 小美 "], ["handle", "mei.daily"], ["igUsername", "@mei.daily"],
      ["followerCount", " 12000 "], ["region", "台北市"], ["categories", "美妝"], ["categories", " 穿搭"],
    ]))).toEqual({
      displayName: "小美", handle: "mei.daily", igUsername: "mei.daily",
      followerCount: "12000", region: "台北市", categories: ["美妝", "穿搭"],
    });
  });
});
