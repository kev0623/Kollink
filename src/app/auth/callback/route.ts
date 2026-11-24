import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postLoginPath } from "@/lib/auth/after-login";

/** Google OAuth 回呼：交換 session 後依身分導向。 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  const path = await postLoginPath(supabase, url.searchParams.get("role"), url.searchParams.get("next"));
  const target = new URL(path, url.origin);
  return NextResponse.redirect(target.origin === url.origin ? target : new URL("/", url.origin));
}
