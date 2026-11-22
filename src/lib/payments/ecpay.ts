import { createHash, timingSafeEqual } from "node:crypto";

export type EcpayParams = Record<string, string>;

/** 與 .NET HttpUtility.UrlEncode 相同的編碼，再轉成全部小寫（綠界檢查碼規則）。 */
export function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7e")
    .replace(/'/g, "%27")
    .toLowerCase();
}

export function computeCheckMacValue(params: EcpayParams, hashKey: string, hashIV: string): string {
  const query = Object.entries(params)
    .filter(([key]) => key !== "CheckMacValue")
    .sort(([a], [b]) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const raw = `HashKey=${hashKey}&${query}&HashIV=${hashIV}`;
  return createHash("sha256").update(ecpayUrlEncode(raw)).digest("hex").toUpperCase();
}

export function verifyCheckMacValue(params: EcpayParams, hashKey: string, hashIV: string): boolean {
  const received = params.CheckMacValue;
  if (!received) return false;

  const expected = Buffer.from(computeCheckMacValue(params, hashKey, hashIV), "utf8");
  const actual = Buffer.from(received.toUpperCase(), "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
