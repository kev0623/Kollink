import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { resolvePostLoginPath } from "./post-login";

/** 查目前使用者的身分，決定登入後要去哪裡。沒有 session 時回到 /login。 */
export async function postLoginPath(
  supabase: SupabaseClient<Database>,
  requestedRole: string | null,
  next: string | null,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) return "/login?error=profile";
  return resolvePostLoginPath({ role: profile?.role ?? null, requestedRole, next });
}
