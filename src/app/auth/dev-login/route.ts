import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { DEV_ACCOUNTS, isDevAccount, isDevLoginEnabled } from "@/lib/auth/dev-login";
import { CATEGORIES, INDUSTRIES, REGIONS } from "@/lib/options";

/** 本機測試快速登入。非本機開發環境一律 404。 */
export async function POST(request: NextRequest) {
  if (!isDevLoginEnabled()) return new NextResponse(null, { status: 404 });

  const form = await request.formData().catch(() => null);
  const account = form?.get("account");
  if (!isDevAccount(account)) return new NextResponse(null, { status: 400 });
  const email = DEV_ACCOUNTS[account];

  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
  // 已存在的帳號會回 email_exists，視為正常。
  if (createErr && createErr.code !== "email_exists") return fail(`createUser: ${createErr.message}`);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link.properties?.hashed_token) return fail(`generateLink: ${linkErr?.message ?? "no token"}`);

  const supabase = await createClient();
  const { data: sess, error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpErr || !sess.user) return fail(`verifyOtp: ${otpErr?.message ?? "no user"}`);
  const uid = sess.user.id;

  // 計畫 9：測試管理員沒有 profile，只加進 admins（service_role 可以寫 admins；正式環境的管理員只用 SQL 新增）
  if (account === "admin") {
    const { error } = await admin.from("admins").upsert({ user_id: uid }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) return fail(`admins: ${error.message}`);
    return relativeRedirect("/admin", 303);
  }

  const { data: profile, error: profErr } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (profErr) return fail(`profiles: ${profErr.message}`);

  if (!profile) {
    if (account === "brand") {
      const { error } = await supabase.rpc("create_brand_account", {
        p_brand_name: "測試品牌",
        p_industry: INDUSTRIES[0],
      });
      if (error) return fail(`create_brand_account: ${error.message}`);
    } else {
      const { error } = await supabase.rpc("create_creator_account", {
        p_display_name: "測試創作者",
        p_handle: "devcreator",
        p_ig_username: "devcreator",
        p_follower_count: 1000,
        p_region: REGIONS[0],
        p_categories: [CATEGORIES[0]],
      });
      if (error) return fail(`create_creator_account: ${error.message}`);
    }
  }

  if (account === "creator") {
    const { error } = await admin.from("creator_profiles").update({ status: "approved" }).eq("user_id", uid);
    if (error) return fail(`approve: ${error.message}`);
  }

  return relativeRedirect(account === "brand" ? "/brand" : "/creator", 303);
}

function fail(message: string) {
  return new NextResponse(`dev-login 失敗：${message}`, { status: 500 });
}
