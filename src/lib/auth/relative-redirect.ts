import { NextResponse } from "next/server";

/**
 * 站內相對導向。Location 標頭只能是 ASCII：用 URL 解析讓中文、空白、引號都被百分比編碼，
 * 並丟掉任何來源（path 本來就應該已由 safeNextPath 清理過）。
 * extraHeaders：例如 Supabase 換發 session 時要求的 Cache-Control（Location 一律以這裡算出的為準）。
 */
export function relativeRedirect(path: string, status = 307, extraHeaders?: Record<string, string>): NextResponse {
  const u = new URL(path, "http://n");
  let location = u.pathname + u.search + u.hash;
  // "/.//evil.com" 經解析後會變成 "//evil.com"（協定相對網址），一律退回首頁。
  if (location.startsWith("//") || !location.startsWith("/")) location = "/";
  return new NextResponse(null, { status, headers: { ...extraHeaders, Location: location } });
}
