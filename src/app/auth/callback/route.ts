import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { postLoginPath } from "@/lib/auth/after-login";

/** Google OAuth 回呼：交換 session 後依身分導向。 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  if (!code) return relativeRedirect("/login?error=callback");

  // Supabase 換發 session 時要求的 Cache-Control（private, no-store）要套到這個帶 Set-Cookie 的回應上
  const responseHeaders: Record<string, string> = {};
  const supabase = await createClient({ responseHeaders });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return relativeRedirect("/login?error=callback", 307, responseHeaders);

  const path = await postLoginPath(supabase, url.searchParams.get("role"), url.searchParams.get("next"));
  // path 已由 resolvePostLoginPath 清理過，只會是站內相對路徑。
  return relativeRedirect(path, 307, responseHeaders);
}
