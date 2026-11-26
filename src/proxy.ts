import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { requiresAuth } from "@/lib/auth/routes";

// 只做樂觀檢查：更新 session cookie、沒登入就導去 /login。身分與資料完整度由各區 layout 檢查。
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  if (!user && requiresAuth(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    // 帶上 Cache-Control 等標頭，避免帶 session cookie 的導向被 CDN 快取
    response.headers.forEach((v, k) => {
      if (k.toLowerCase() === "cache-control" || k.toLowerCase() === "expires" || k.toLowerCase() === "pragma") redirect.headers.set(k, v);
    });
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    // 排除靜態檔、圖片、綠界（notify、payment-info 是伺服器對伺服器；result 只是把瀏覽器導回合作案詳情，
    // 導過去的頁面會再經過 proxy）與 Vercel Cron（不會帶 cookie，也不需要 session）
    "/((?!_next/static|_next/image|favicon.ico|api/payments/ecpay/|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
