import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * 以「目前登入的使用者」身分存取 Supabase，RLS 與狀態函式會依使用者身分判斷。
 *
 * 換發 session 時 @supabase/ssr 會在 setAll 的第二個參數給 Cache-Control: private, no-store 等標頭，
 * 避免帶 Set-Cookie 的回應被 CDN 快取。Route Handler 傳入 responseHeaders，setAll 把標頭收進去，
 * 再由呼叫端套用到回應（relativeRedirect 的第三個參數）；Server Component 不能設定回應標頭，session 由 proxy 負責。
 */
export async function createClient(options?: { responseHeaders?: Record<string, string> }) {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list, headers) => {
          if (options?.responseHeaders && headers) Object.assign(options.responseHeaders, headers);
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component 不能寫 cookie；session 由 proxy 負責更新。
          }
        },
      },
    },
  );
}
