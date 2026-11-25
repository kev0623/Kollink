import { type NextRequest, NextResponse } from "next/server";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { isUuid } from "@/lib/briefs/query";
import { devMerchantTradeNo } from "@/lib/collabs/dev-payment";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 本機測試用「標記已付款」。開關與測試快速登入相同（isDevLoginEnabled），正式環境一律 404。
 * 走與正式付款相同的路徑：service_role 建付款單 → record_payment_success（不呼叫 mark_paid、不開捷徑）。
 */
export async function POST(request: NextRequest) {
  if (!isDevLoginEnabled()) return new NextResponse(null, { status: 404 });

  const form = await request.formData();
  const collabId = form.get("collabId");
  if (!isUuid(collabId)) return new NextResponse(null, { status: 400 });

  // 先用登入者自己的 client 確認是參與者、狀態是待付款
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_collaboration", { p_id: collabId });
  if (error) return fail(`get_collaboration: ${error.message}`);
  const row = ((data ?? []) as unknown as { status: string | null; amount_twd: number | null; my_side: string | null }[])[0];
  if (!row || (row.my_side !== "brand" && row.my_side !== "creator")) return new NextResponse(null, { status: 404 });
  const back = `/${row.my_side}/collabs/${collabId}`;
  if (row.status !== "awaiting_payment" || !row.amount_twd) return relativeRedirect(back, 303);

  const admin = createAdminClient();
  const tradeNo = devMerchantTradeNo();
  const { error: e1 } = await admin.from("payments").insert({
    collaboration_id: collabId, provider: "ecpay", merchant_trade_no: tradeNo, amount_twd: row.amount_twd,
  });
  if (e1) return fail(`insert payment: ${e1.message}`);
  const { data: result, error: e2 } = await admin.rpc("record_payment_success", {
    p_merchant_trade_no: tradeNo,
    p_amount_twd: row.amount_twd,
    p_provider_trade_no: `DEV-${tradeNo}`,
    p_raw: { source: "dev-mark-paid" },
  });
  if (e2) return fail(`record_payment_success: ${e2.message}`);
  if (result !== "paid") return fail(`record_payment_success returned ${String(result)}`);
  return relativeRedirect(back, 303);
}

function fail(message: string) {
  return new NextResponse(`mark-paid 失敗：${message}`, { status: 500 });
}
