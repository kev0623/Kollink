import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postLoginPath } from "@/lib/auth/after-login";

/** Email 驗證碼成功後（session 已寫入 cookie），依身分導向。 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const supabase = await createClient();
  const path = await postLoginPath(supabase, url.searchParams.get("role"), url.searchParams.get("next"));
  const target = new URL(path, url.origin);
  return NextResponse.redirect(target.origin === url.origin ? target : new URL("/", url.origin));
}
