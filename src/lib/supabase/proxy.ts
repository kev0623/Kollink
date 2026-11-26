import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * 更新 session cookie，並回傳目前使用者（未登入為 null）。
 * forwardHeaders：額外加到往後傳的請求標頭（覆寫用戶端帶的同名標頭）。每次都從 request.headers 重新複製，
 * 所以 setAll 寫進 request.cookies 的新 session 一樣會往後傳。
 */
export async function updateSession(
  request: NextRequest, forwardHeaders: Record<string, string> = {},
): Promise<{ response: NextResponse; user: User | null }> {
  const next = () => {
    const headers = new Headers(request.headers);
    Object.entries(forwardHeaders).forEach(([k, v]) => headers.set(k, v));
    return NextResponse.next({ request: { headers } });
  };
  let response = next();
  const supabase = createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = next();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { response, user };
}
