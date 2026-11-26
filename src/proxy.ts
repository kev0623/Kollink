import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { authPageRedirect, invalidCreatorPath, requiresAuth } from "@/lib/auth/routes";
import { REQUEST_PATH_HEADER, requestPath } from "@/lib/auth/admin-next";

// 只做樂觀檢查：更新 session cookie、沒登入就導去 /login、已登入者不看登入頁。身分與資料完整度由各區 layout 檢查。
export async function proxy(request: NextRequest) {
  // 格式不合法的公開頁：rewrite 到不存在的路由，Next 會以 404 狀態渲染 app/not-found.tsx（Next 文件 loading.md「Status codes」）
  if (invalidCreatorPath(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/_kollink-not-found", request.url));
  }
  // requireAdmin() 用這個標頭決定管理員通過第二步驟後回哪一頁（一律覆寫用戶端帶的值）
  const { response, user } = await updateSession(request, { [REQUEST_PATH_HEADER]: requestPath(request.nextUrl) });

  /** 導向時帶上新的 session cookie 與 Cache-Control 等標頭（避免帶 session cookie 的導向被 CDN 快取）。 */
  function redirectTo(url: URL) {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    response.headers.forEach((v, k) => {
      const key = k.toLowerCase();
      if (key === "cache-control" || key === "expires" || key === "pragma") redirect.headers.set(k, v);
    });
    return redirect;
  }

  if (!user && requiresAuth(request.nextUrl.pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return redirectTo(login);
  }
  if (user) {
    const to = authPageRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
    if (to) return redirectTo(new URL(to, request.url));
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
