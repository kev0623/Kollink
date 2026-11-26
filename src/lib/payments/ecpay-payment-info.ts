import { verifyCheckMacValue } from "./ecpay";
import { MERCHANT_TRADE_NO_RE, parseAtmInfo, parseTradeAmt, pickNotifyFields } from "./notify-fields";

export type RecordPaymentInfoResult = "recorded" | "unchanged" | "ignored" | "anomaly";

export interface EcpayPaymentInfoDeps {
  hashKey: string;
  hashIV: string;
  merchantId: string;
  recordPaymentInfo(input: {
    merchantTradeNo: string;
    providerTradeNo: string;
    amountTwd: number;
    bankCode: string;
    vAccount: string;
    expireDate: string;
    raw: Record<string, string>;
  }): Promise<RecordPaymentInfoResult>;
  logError(message: string, meta?: Record<string, unknown>): void;
}

/**
 * ATM 取號結果通知（PaymentInfoURL，https://developers.ecpay.com.tw/?p=2881）。
 * RtnCode=2 才是取號成功；其他代碼回 1|OK 並留 log（取號失敗時品牌重新付款即可）。
 * 這個通知不代表已付款：付款後綠界另外打 ReturnURL。
 */
export async function handleEcpayPaymentInfo(
  params: Record<string, string>,
  deps: EcpayPaymentInfoDeps,
): Promise<{ status: number; body: string }> {
  const merchantTradeNo = (params.MerchantTradeNo ?? "").slice(0, 64);

  if (!verifyCheckMacValue(params, deps.hashKey, deps.hashIV)) {
    deps.logError("ecpay payment-info: bad CheckMacValue", { merchantTradeNo });
    return { status: 400, body: "0|CheckMacValue Error" };
  }
  if (params.MerchantID !== deps.merchantId) {
    deps.logError("ecpay payment-info: merchant mismatch", { merchantTradeNo });
    return { status: 400, body: "0|MerchantID Error" };
  }
  if (!MERCHANT_TRADE_NO_RE.test(merchantTradeNo)) {
    deps.logError("ecpay payment-info: bad MerchantTradeNo", { merchantTradeNo });
    return { status: 400, body: "0|Bad MerchantTradeNo" };
  }
  if (params.RtnCode !== "2") {
    deps.logError("ecpay payment-info: not an ATM number", {
      merchantTradeNo,
      rtnCode: (params.RtnCode ?? "").slice(0, 16),
    });
    return { status: 200, body: "1|OK" };
  }

  const amountTwd = parseTradeAmt(params.TradeAmt);
  const providerTradeNo = (params.TradeNo ?? "").trim();
  const info = parseAtmInfo(params);
  if (amountTwd === null || !providerTradeNo || !info) {
    deps.logError("ecpay payment-info: bad fields", { merchantTradeNo });
    return { status: 400, body: "0|Bad PaymentInfo" };
  }

  try {
    const result = await deps.recordPaymentInfo({
      merchantTradeNo, providerTradeNo, amountTwd, ...info, raw: pickNotifyFields(params),
    });
    if (result === "anomaly") deps.logError("ecpay payment-info: anomaly recorded", { merchantTradeNo, amountTwd });
    return { status: 200, body: "1|OK" };
  } catch (error) {
    deps.logError("ecpay payment-info: record failed", { merchantTradeNo, error: String(error) });
    return { status: 500, body: "0|Error" };
  }
}
