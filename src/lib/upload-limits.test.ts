import { describe, expect, it } from "vitest";
import { hasAllowedImageExtension, UPLOAD_QUOTA, uploadErrorMessage } from "./upload-limits";
import { planMediaUpload } from "./creator-media";
import { planCoverUpload } from "./brief-cover";

describe("hasAllowedImageExtension", () => {
  it("接受 jpg／jpeg／png／webp（不分大小寫）", () => {
    for (const n of ["a.jpg", "a.JPEG", "a.png", "x.y.webp"]) expect(hasAllowedImageExtension(n)).toBe(true);
  });
  it("拒絕其他副檔名、沒有副檔名、沒有檔名", () => {
    for (const n of ["a.html", "a.svg", "a.gif", "a", "a.", undefined]) expect(hasAllowedImageExtension(n)).toBe(false);
  });
});

describe("uploadErrorMessage", () => {
  it("403 或 RLS 錯誤：提示可能已達上限", () => {
    expect(uploadErrorMessage({ statusCode: "403", message: "x" }, "creator-media")).toContain(String(UPLOAD_QUOTA["creator-media"]));
    expect(uploadErrorMessage({ message: "new row violates row-level security policy" }, "brand-logos")).toContain("20");
    expect(uploadErrorMessage({ statusCode: 403 }, "deliverables")).toContain("這個合作案");
  });
  it("其他錯誤：通用訊息", () => {
    expect(uploadErrorMessage({ statusCode: "500", message: "boom" }, "brief-covers")).toBe("上傳失敗，請再試一次");
    expect(uploadErrorMessage(null, "brief-covers")).toBe("上傳失敗，請再試一次");
  });
});

describe("上傳前的副檔名檢查", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("檔名副檔名不在白名單就擋下（內容類型是圖片也一樣）", () => {
    expect(planMediaUpload("u", "avatar", { type: "image/png", size: 10, name: "x.html" }, id)).toEqual({ error: "只接受 JPG、PNG、WebP" });
    expect(planCoverUpload("u", { type: "image/png", size: 10, name: "x.gif" }, id)).toEqual({ error: "只接受 JPG、PNG、WebP" });
  });
  it("合法的檔名產生路徑", () => {
    expect(planMediaUpload("u", "avatar", { type: "image/jpeg", size: 10, name: "me.JPEG" }, id)).toEqual({ path: `u/avatar-${id}.jpg` });
  });
});
