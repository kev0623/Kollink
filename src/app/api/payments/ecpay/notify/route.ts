import { requireEnv } from "@/lib/env";
import { handleEcpayNotify, type RecordPaymentResult } from "@/lib/payments/ecpay-notify";
import { createAdminClient } from "@/lib/supabase/admin";

const KNOWN_RESULTS: readonly string[] = ["paid", "already_paid", "paid_refund_required"];

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const params: Record<string, string> = {};
    try {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") params[key] = value;
      }
    } catch {
      return text("0|Bad Request", 400);
    }

    const result = await handleEcpayNotify(params, {
      hashKey: requireEnv("ECPAY_HASH_KEY"),
      hashIV: requireEnv("ECPAY_HASH_IV"),
      merchantId: requireEnv("ECPAY_MERCHANT_ID"),
      async recordPaymentSuccess({ merchantTradeNo, amountTwd, providerTradeNo, raw }) {
        const supabase = createAdminClient();
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

    return text(result.body, result.status);
  } catch (error) {
    console.error("ecpay notify: unhandled error", error);
    return text("0|Error", 500);
  }
}
