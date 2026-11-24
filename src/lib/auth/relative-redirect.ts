import { NextResponse } from "next/server";

/**
 * 站內相對導向。Location 標頭只能是 ASCII：用 URL 解析讓中文、空白、引號都被百分比編碼，
 * 並丟掉任何來源（path 本來就應該已由 safeNextPath 清理過）。
 */
export function relativeRedirect(path: string, status = 307): NextResponse {
  const u = new URL(path, "http://n");
  const location = u.pathname + u.search + u.hash;
  return new NextResponse(null, { status, headers: { Location: location } });
}
