import { verifyCheckMacValue } from "./ecpay";

export type RecordPaymentResult = "paid" | "already_paid" | "paid_refund_required";

export interface EcpayNotifyDeps {
  hashKey: string;
  hashIV: string;
  merchantId: string;
  recordPaymentSuccess(input: {
    merchantTradeNo: string;
    amountTwd: number;
    providerTradeNo: string;
    raw: Record<string, string>;
  }): Promise<RecordPaymentResult>;
  logError(message: string, meta?: Record<string, unknown>): void;
}

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

  if (params.SimulatePaid === "1") {
    deps.logError("ecpay notify: simulated payment ignored", { merchantTradeNo });
    return { status: 200, body: "1|OK" };
  }

  if (params.RtnCode !== "1") {
    return { status: 200, body: "1|OK" };
  }

  if (!/^[1-9]\d{0,8}$/.test(params.TradeAmt ?? "")) {
    deps.logError("ecpay notify: bad TradeAmt", {
      merchantTradeNo,
      tradeAmt: (params.TradeAmt ?? "").slice(0, 32),
    });
    return { status: 400, body: "0|Bad TradeAmt" };
  }
  const amountTwd = Number(params.TradeAmt);

  const providerTradeNo = params.TradeNo;
  if (!providerTradeNo) {
    deps.logError("ecpay notify: missing TradeNo", { merchantTradeNo });
    return { status: 400, body: "0|Missing TradeNo" };
  }

  try {
    const result = await deps.recordPaymentSuccess({
      merchantTradeNo,
      amountTwd,
      providerTradeNo,
      raw: params,
    });
    if (result === "paid_refund_required") {
      deps.logError("ecpay notify: payment requires refund", { merchantTradeNo });
    }
    return { status: 200, body: "1|OK" };
  } catch (error) {
    deps.logError("ecpay notify: record failed", { merchantTradeNo, error: String(error) });
    return { status: 500, body: "0|Error" };
  }
}
