// 錯誤文字裡提到「聯絡平台／客服」時，畫面要接一個真的聯絡方式（QA M4）。
const SUPPORT_RE = /聯絡(平台|客服|我們)/;

export function mentionsSupport(message: string | null | undefined): boolean {
  return typeof message === "string" && SUPPORT_RE.test(message);
}
