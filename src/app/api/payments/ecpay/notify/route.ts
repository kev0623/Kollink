import { readEcpayConfig } from "@/lib/payments/config";
import { handleEcpayNotify, type RecordPaymentResult } from "@/lib/payments/ecpay-notify";
import { ecpayText, readEcpayForm } from "@/lib/payments/http";
import { createAdminClient } from "@/lib/supabase/admin";

const KNOWN_RESULTS: readonly string[] = ["paid", "already_paid", "paid_refund_required", "anomaly"];

/**
 * 綠界付款結果通知（ReturnURL，伺服器對伺服器）。不需要登入、proxy 不經手（proxy.ts matcher 排除 api/payments/ecpay/）。
 * 身分靠 CheckMacValue（HashKey／HashIV）與 MerchantID；不看 cookie、Origin。
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const config = readEcpayConfig();
    if (!config) {
      console.error("ecpay notify: not configured");
      return ecpayText("0|Not configured", 500);
    }
    const params = await readEcpayForm(request);
    if (!params) return ecpayText("0|Bad Request", 400);

    const result = await handleEcpayNotify(params, {
      hashKey: config.hashKey,
      hashIV: config.hashIV,
      merchantId: config.merchantId,
      env: config.env,
      async recordPaymentSuccess({ merchantTradeNo, amountTwd, providerTradeNo, raw, env }) {
        const { data, error } = await createAdminClient().rpc("record_payment_success", {
          p_merchant_trade_no: merchantTradeNo,
          p_amount_twd: amountTwd,
          p_provider_trade_no: providerTradeNo,
          p_raw: raw,
          p_env: env,
        });
        if (error) throw new Error(`${error.code}: ${error.message}`);
        if (typeof data !== "string" || !KNOWN_RESULTS.includes(data)) {
          throw new Error(`unexpected record_payment_success result: ${JSON.stringify(data)}`);
        }
        return data as RecordPaymentResult;
      },
      logError: (message, meta) => console.error(message, meta),
    });

    return ecpayText(result.body, result.status);
  } catch (error) {
    console.error("ecpay notify: unhandled error", error);
    return ecpayText("0|Error", 500);
  }
}
