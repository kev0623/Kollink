import { readEcpayConfig } from "@/lib/payments/config";
import { handleEcpayPaymentInfo, type RecordPaymentInfoResult } from "@/lib/payments/ecpay-payment-info";
import { ecpayText, readEcpayForm } from "@/lib/payments/http";
import { createAdminClient } from "@/lib/supabase/admin";

const KNOWN_RESULTS: readonly string[] = ["recorded", "unchanged", "ignored", "anomaly"];

/** 綠界 ATM 取號結果通知（PaymentInfoURL，伺服器對伺服器）。驗證方式與 notify 相同。 */
export async function POST(request: Request): Promise<Response> {
  try {
    const config = readEcpayConfig();
    if (!config) {
      console.error("ecpay payment-info: not configured");
      return ecpayText("0|Not configured", 500);
    }
    const params = await readEcpayForm(request);
    if (!params) return ecpayText("0|Bad Request", 400);

    const result = await handleEcpayPaymentInfo(params, {
      hashKey: config.hashKey,
      hashIV: config.hashIV,
      merchantId: config.merchantId,
      async recordPaymentInfo({ merchantTradeNo, providerTradeNo, amountTwd, bankCode, vAccount, expireDate, raw }) {
        const { data, error } = await createAdminClient().rpc("record_payment_info", {
          p_merchant_trade_no: merchantTradeNo,
          p_provider_trade_no: providerTradeNo,
          p_amount_twd: amountTwd,
          p_bank_code: bankCode,
          p_v_account: vAccount,
          p_expire_date: expireDate,
          p_raw: raw,
        });
        if (error) throw new Error(`${error.code}: ${error.message}`);
        if (typeof data !== "string" || !KNOWN_RESULTS.includes(data)) {
          throw new Error(`unexpected record_payment_info result: ${JSON.stringify(data)}`);
        }
        return data as RecordPaymentInfoResult;
      },
      logError: (message, meta) => console.error(message, meta),
    });

    return ecpayText(result.body, result.status);
  } catch (error) {
    console.error("ecpay payment-info: unhandled error", error);
    return ecpayText("0|Error", 500);
  }
}
