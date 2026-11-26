import { type NextRequest, NextResponse } from "next/server";
import { LINE_LINK_COOKIE, readLineConfig } from "@/lib/auth/line/config";
import { unseal } from "@/lib/auth/line/sealed-cookie";
import { pendingEmail } from "@/lib/auth/line/pending";

/**
 * GET /auth/line/pending：/login?line=verify 的畫面需要知道要把驗證碼寄到哪個 Email。
 * 只回傳這個瀏覽器自己的加密 cookie 裡、LINE 提供的 Email（使用者自己的地址），不回傳 LINE ID 或帳號資訊。
 * cookie 是 SameSite=Lax、只送到 /auth/line；跨站請求帶不到 cookie，也讀不到回應（沒有 CORS）。
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return NextResponse.json({ error: "failed" }, { status: 403, headers });
  const config = readLineConfig();
  const link = config
    ? unseal<Record<string, unknown>>(request.cookies.get(LINE_LINK_COOKIE)?.value, "link", config.channelSecret, Math.floor(Date.now() / 1000))
    : null;
  const email = pendingEmail(link);
  return NextResponse.json(email ? { email } : { error: "expired" }, { headers });
}
