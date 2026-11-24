"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  // scope "local"：只登出這個裝置，不影響使用者在其他裝置的登入。
  // 即使呼叫失敗（例如網路問題），也要清掉本機 cookie 並導回首頁，不讓使用者卡在已登出的畫面。
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    const store = await cookies();
    for (const c of store.getAll()) {
      if (c.name.startsWith("sb-")) store.delete(c.name);
    }
  }
  redirect("/");
}
