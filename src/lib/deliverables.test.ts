import { describe, expect, it } from "vitest";
import { DELIVERABLE_ACCEPT, fileKindOf, fileLabel, isOwnDeliverablePath, planDeliverableUpload } from "./deliverables";

const C = "00000000-0000-0000-0000-0000000007d1";
const U = "00000000-0000-0000-0000-000000000731";
const ID = "11111111-1111-4111-8111-111111111111";

describe("planDeliverableUpload", () => {
  it("合規的檔案產生 <合作案>/<創作者>/<uuid>.<副檔名>", () => {
    expect(planDeliverableUpload(C, U, { type: "image/png", size: 10 }, ID)).toEqual({ path: `${C}/${U}/${ID}.png` });
    expect(planDeliverableUpload(C, U, { type: "video/quicktime", size: 10 }, ID)).toEqual({ path: `${C}/${U}/${ID}.mov` });
    expect(planDeliverableUpload(C, U, { type: "application/pdf", size: 10 }, ID.toUpperCase())).toEqual({ path: `${C}/${U}/${ID}.pdf` });
  });
  it("不接受的格式與超過 50MB", () => {
    expect(planDeliverableUpload(C, U, { type: "image/gif", size: 10 }, ID)).toEqual({ error: "只接受 JPG、PNG、WebP、MP4、MOV、PDF" });
    expect(planDeliverableUpload(C, U, { type: "video/mp4", size: 50 * 1024 * 1024 + 1 }, ID)).toEqual({ error: "每個檔案不能超過 50MB" });
  });
  it("accept 清單", () => {
    expect(DELIVERABLE_ACCEPT).toBe("image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf");
  });
});

describe("isOwnDeliverablePath", () => {
  it("只接受自己的資料夾與合規檔名", () => {
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/${ID}.jpg`)).toBe(true);
    expect(isOwnDeliverablePath(C, U, `${C}/other/${ID}.jpg`)).toBe(false);
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/x/${ID}.jpg`)).toBe(false);
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/${ID}.exe`)).toBe(false);
    expect(isOwnDeliverablePath(C, U, `${C}/${U}/../${ID}.jpg`)).toBe(false);
  });
});

describe("檔案種類與標籤", () => {
  it("依副檔名", () => {
    expect(fileKindOf("a/b/c.webp")).toBe("image");
    expect(fileKindOf("a/b/c.MOV")).toBe("video");
    expect(fileKindOf("a/b/c.pdf")).toBe("pdf");
    expect(fileLabel("a/b/c.pdf", 2, 1)).toBe("第 1 次交稿・PDF 3");
    expect(fileLabel("a/b/c.jpg", 0, 2)).toBe("第 2 次交稿・圖片 1");
  });
});
