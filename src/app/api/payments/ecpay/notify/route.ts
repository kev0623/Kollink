import { requireEnv } from "@/lib/env";
import { handleEcpayNotify, type RecordPaymentResult } from "@/lib/payments/ecpay-notify";
import { createAdminClient } from "@/lib/supabase/admin";

const KNOWN_RESULTS: readonly string[] = ["paid", "already_paid", "paid_refund_required"];

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  const supabase = createAdminClient();
  const result = await handleEcpayNotify(params, {
    hashKey: requireEnv("ECPAY_HASH_KEY"),
    hashIV: requireEnv("ECPAY_HASH_IV"),
    async recordPaymentSuccess({ merchantTradeNo, amountTwd, providerTradeNo, raw }) {
      const { data, error } = await supabase.rpc("record_payment_success", {
        p_merchant_trade_no: merchantTradeNo,
        p_amount_twd: amountTwd,
        p_provider_trade_no: providerTradeNo,
        p_raw: raw,
      });
      if (error) throw new Error(`${error.code}: ${error.message}`);
      if (typeof data !== "string" || !KNOWN_RESULTS.includes(data)) {
        throw new Error(`unexpected record_payment_success result: ${JSON.stringify(data)}`);
      }
      return data as RecordPaymentResult;
    },
    logError: (message, meta) => console.error(message, meta),
  });

  return new Response(result.body, {
    status: result.status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
