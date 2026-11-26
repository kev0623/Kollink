import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { resolvePostLoginPath, withMfaStep } from "./post-login";

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
  // is_admin_account：只看 admins 表。is_admin() 要求 aal2，登入當下還沒通過第二步驟，會是 false。
  const [{ data: profile, error }, { data: isAdminAccount, error: adminErr }, { data: isAdmin, error: verifiedErr }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_admin_account"),
    supabase.rpc("is_admin"),
  ]);
  if (error || adminErr || verifiedErr) return "/login?error=profile";
  const path = resolvePostLoginPath({ role: profile?.role ?? null, requestedRole, next, isAdmin: isAdminAccount === true });
  return withMfaStep(path, isAdminAccount === true && isAdmin !== true);
}
