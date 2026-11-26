import { verifyCheckMacValue } from "./ecpay";
import { MERCHANT_TRADE_NO_RE, parseTradeAmt, pickNotifyFields } from "./notify-fields";

export type RecordPaymentResult = "paid" | "already_paid" | "paid_refund_required" | "anomaly";

export interface EcpayNotifyDeps {
  hashKey: string;
  hashIV: string;
  merchantId: string;
  /** 驗證通知用的是哪一組金鑰：stage 才接受 SimulatePaid=1 */
  env: "stage" | "prod";
  recordPaymentSuccess(input: {
    merchantTradeNo: string;
    amountTwd: number;
    providerTradeNo: string;
    raw: Record<string, string>;
    env: "stage" | "prod";
  }): Promise<RecordPaymentResult>;
  logError(message: string, meta?: Record<string, unknown>): void;
}

/**
 * 付款結果通知（ReturnURL，https://developers.ecpay.com.tw/?p=2878）。
 * 驗簽與 MerchantID 不符回 400（綠界會重送，但重送也不會過，只留 log）；
 * 其他情況（成功、重複、需退款、異常、付款失敗）一律 1|OK，避免綠界重送；記錄失敗回 500 讓綠界重送。
 */
export async function handleEcpayNotify(
  params: Record<string, string>,
  deps: EcpayNotifyDeps,
): Promise<{ status: number; body: string }> {
  const merchantTradeNo = (params.MerchantTradeNo ?? "").slice(0, 64);

  if (!verifyCheckMacValue(params, deps.hashKey, deps.hashIV)) {
    deps.logError("ecpay notify: bad CheckMacValue", { merchantTradeNo });
    return { status: 400, body: "0|CheckMacValue Error" };
  }

  if (params.MerchantID !== deps.merchantId) {
    deps.logError("ecpay notify: merchant mismatch", { merchantTradeNo });
    return { status: 400, body: "0|MerchantID Error" };
  }

  if (!MERCHANT_TRADE_NO_RE.test(merchantTradeNo)) {
    deps.logError("ecpay notify: bad MerchantTradeNo", { merchantTradeNo });
    return { status: 400, body: "0|Bad MerchantTradeNo" };
  }

  // 模擬付款（綠界廠商後台「模擬付款」）不是真的收到錢：正式環境一律忽略；測試環境照常記錄（測試 ATM 只能靠它）
  if (params.SimulatePaid === "1" && deps.env !== "stage") {
    deps.logError("ecpay notify: simulated payment ignored", { merchantTradeNo });
    return { status: 200, body: "1|OK" };
  }

  if (params.RtnCode !== "1") {
    deps.logError("ecpay notify: payment not successful", {
      merchantTradeNo,
      rtnCode: (params.RtnCode ?? "").slice(0, 16),
    });
    return { status: 200, body: "1|OK" };
  }

  const amountTwd = parseTradeAmt(params.TradeAmt);
  if (amountTwd === null) {
    deps.logError("ecpay notify: bad TradeAmt", {
      merchantTradeNo,
      tradeAmt: (params.TradeAmt ?? "").slice(0, 32),
    });
    return { status: 400, body: "0|Bad TradeAmt" };
  }

  const providerTradeNo = (params.TradeNo ?? "").trim();
  if (!providerTradeNo) {
    deps.logError("ecpay notify: missing TradeNo", { merchantTradeNo });
    return { status: 400, body: "0|Missing TradeNo" };
  }

  try {
    const result = await deps.recordPaymentSuccess({
      merchantTradeNo,
      amountTwd,
      providerTradeNo,
      raw: pickNotifyFields(params),
      env: deps.env,
    });
    if (result === "paid_refund_required") {
      deps.logError("ecpay notify: payment requires refund", { merchantTradeNo });
    } else if (result === "anomaly") {
      deps.logError("ecpay notify: payment anomaly recorded", { merchantTradeNo, amountTwd });
    }
    return { status: 200, body: "1|OK" };
  } catch (error) {
    deps.logError("ecpay notify: record failed", { merchantTradeNo, error: String(error) });
    return { status: 500, body: "0|Error" };
  }
}
