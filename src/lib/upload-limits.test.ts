import { describe, expect, it } from "vitest";
import { UPLOAD_QUOTA, uploadErrorMessage } from "./upload-limits";
import { planMediaUpload } from "./creator-media";
import { planCoverUpload } from "./brief-cover";

describe("uploadErrorMessage", () => {
  it("403 或 RLS 錯誤：提示可能已達上限", () => {
    expect(uploadErrorMessage({ statusCode: "403", message: "x" }, "creator-media")).toContain(String(UPLOAD_QUOTA["creator-media"]));
    expect(uploadErrorMessage({ message: "new row violates row-level security policy" }, "brand-logos")).toContain("40");
    expect(uploadErrorMessage({ statusCode: 403 }, "deliverables")).toContain("這個合作案");
    expect(uploadErrorMessage({ statusCode: 403 }, "creator-media")).not.toContain("刪除");
  });
  it("其他錯誤：通用訊息", () => {
    expect(uploadErrorMessage({ statusCode: "500", message: "boom" }, "brief-covers")).toBe("上傳失敗，請再試一次");
    expect(uploadErrorMessage(null, "brief-covers")).toBe("上傳失敗，請再試一次");
  });
});

describe("上傳前只看內容類型", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("路徑的副檔名由內容類型決定，檔名沒有副檔名也可以", () => {
    expect(planMediaUpload("u", "avatar", { type: "image/jpeg", size: 10 }, id)).toEqual({ path: `u/avatar-${id}.jpg` });
    expect(planCoverUpload("u", { type: "image/png", size: 10 }, id)).toEqual({ path: `u/cover-${id}.png` });
  });
  it("不允許的內容類型照樣擋下", () => {
    expect(planMediaUpload("u", "avatar", { type: "text/html", size: 10 }, id)).toEqual({ error: "只接受 JPG、PNG、WebP" });
    expect(planCoverUpload("u", { type: "image/gif", size: 10 }, id)).toEqual({ error: "只接受 JPG、PNG、WebP" });
  });
});
