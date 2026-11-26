import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor, type Role } from "./post-login";
import { mfaRedirectPath, REQUEST_PATH_HEADER } from "./admin-next";

/** rejected：管理員退回（計畫 9），創作者修正後可以重新送審。 */
export type CreatorStatus = "pending" | "approved" | "suspended" | "rejected";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: { role: Role; displayName: string } | null;
  brand: { brandName: string; industry: string | null; logoPath: string | null } | null;
  creator: {
    handle: string;
    igUsername: string;
    followerCount: number;
    region: string | null;
    categories: string[];
    status: CreatorStatus;
    handleLocked: boolean;
    /** 退回或停權的原因（管理員寫的，只有本人看得到）；其他狀態是 null */
    reviewNote: string | null;
  } | null;
  verificationCode: string | null;
};

/** 目前登入的使用者與其資料。會讀 cookie，只能在 <Suspense> 內呼叫。 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // 結果依每次請求而異：先等請求進來再往下，避免預渲染階段就建立 Supabase client（auth-js 會讀 Date.now()）
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles").select("role, display_name").eq("id", user.id).maybeSingle();
  if (error) throw error;

  const base: CurrentUser = {
    id: user.id,
    email: user.email ?? null,
    profile: profile ? { role: profile.role, displayName: profile.display_name } : null,
    brand: null,
    creator: null,
    verificationCode: null,
  };

  if (profile?.role === "brand") {
    const { data, error: e } = await supabase
      .from("brand_profiles").select("brand_name, industry, logo_path").eq("user_id", user.id).maybeSingle();
    if (e) throw e;
    return { ...base, brand: data ? { brandName: data.brand_name, industry: data.industry, logoPath: data.logo_path } : null };
  }

  if (profile?.role === "creator") {
    const [{ data: c, error: e1 }, { data: v, error: e2 }] = await Promise.all([
      supabase.from("creator_profiles")
        .select("handle, ig_username, follower_count, region, categories, status, handle_locked_at, review_note")
        .eq("user_id", user.id).maybeSingle(),
      supabase.from("creator_verifications").select("code").eq("user_id", user.id).maybeSingle(),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    return {
      ...base,
      creator: c ? {
        handle: c.handle,
        igUsername: c.ig_username,
        followerCount: c.follower_count,
        region: c.region,
        categories: c.categories,
        status: c.status as CreatorStatus,
        handleLocked: c.handle_locked_at !== null,
        reviewNote: c.review_note ?? null,
      } : null,
      verificationCode: v?.code ?? null,
    };
  }

  return base;
});

/** 目前使用者是不是管理員帳號（admins 表；不看第二步驟）。沒有登入是 false。會讀 cookie。 */
export const getIsAdminAccount = cache(async (): Promise<boolean> => {
  const me = await getCurrentUser();
  if (!me) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin_account");
  if (error) throw error;
  return data === true;
});

/** 管理員帳號而且這個 session 已通過第二步驟（aal2）：資料庫的 is_admin() 就是這個條件。 */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  const me = await getCurrentUser();
  if (!me) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return data === true;
});

/**
 * 管理後台的守門（計畫 9）：每個 /admin 頁面與 Server Action 都要呼叫（同 requireRole 的理由）。
 * 未登入導到登入頁；不是管理員導回自己的首頁（沒有 profile 的導到 /onboarding）；
 * 是管理員帳號但還沒通過第二步驟（TOTP，aal2）導到 /admin/mfa?next=<原本的頁面>（proxy.ts 放的請求路徑，
 * 經 adminNextPath 檢查：safeNextPath ＋ 只限 /admin 底下），驗證完回原本的頁面。
 * 管理員不一定有 profile：通常是專用帳號，只在 admins 表裡。
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/admin");
  if (await getIsAdmin()) return me;
  if (await getIsAdminAccount()) redirect(mfaRedirectPath((await headers()).get(REQUEST_PATH_HEADER)));
  redirect(me.profile ? homeFor(me.profile.role) : "/onboarding");
}

/**
 * 頁面與 Server Action 的角色守門：layout 在用戶端切換頁面時不會重新執行，所以每個讀取使用者資料的頁面都要自己呼叫。
 * 未登入導到登入頁、還沒填資料導到 /onboarding、角色不符導回自己的首頁。
 */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=${homeFor(role)}`);
  if (!me.profile) redirect("/onboarding");
  if (me.profile.role !== role) redirect(homeFor(me.profile.role));
  return me;
}
