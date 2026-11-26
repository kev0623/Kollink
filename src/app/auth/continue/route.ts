import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { postLoginPath } from "@/lib/auth/after-login";

/** Email 驗證碼成功後（session 已寫入 cookie），依身分導向。 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const responseHeaders: Record<string, string> = {};
  const supabase = await createClient({ responseHeaders });
  const path = await postLoginPath(supabase, url.searchParams.get("role"), url.searchParams.get("next"));
  // path 已由 resolvePostLoginPath 清理過，只會是站內相對路徑。
  return relativeRedirect(path, 307, responseHeaders);
}
