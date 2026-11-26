import "server-only";
import { createClient } from "@/lib/supabase/server";

/** 創作者本人有沒有收款帳戶（RLS 只讓本人讀自己的列；只選 user_id，不碰帳號欄位）。呼叫前要先 requireRole("creator")。 */
export async function loadHasPayoutAccount(uid: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("creator_payout_accounts").select("user_id", { count: "exact", head: true }).eq("user_id", uid);
  if (error) throw error;
  return (count ?? 0) > 0;
}
