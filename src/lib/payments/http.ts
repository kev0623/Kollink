// 綠界 server-to-server 通知的共用小工具：讀表單、回純文字。

/** 通知內容上限（bytes）：綠界通知遠小於此值。 */
export const MAX_NOTIFY_BYTES = 65_536;

/** 以串流讀文字，超過上限就中止並回傳 null。 */
async function readTextCapped(request: Request, max: number): Promise<string | null> {
  const body = request.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * 讀 x-www-form-urlencoded 表單成字串物件；不是表單、太大或壞掉回傳 null。
 * 允許沒有 content-length（chunked）：改以串流讀取並限制 64 KB；有宣告且超過上限則直接拒絕。
 */
export async function readEcpayForm(request: Request): Promise<Record<string, string> | null> {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded") return null;
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^[0-9]+$/.test(length) || Number(length) > MAX_NOTIFY_BYTES) return null;
  }
  try {
    const text = await readTextCapped(request, MAX_NOTIFY_BYTES);
    if (text === null) return null;
    const params: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(text).entries()) params[key] = value;
    return params;
  } catch {
    return null;
  }
}

/** 綠界要求回應純文字 1|OK（大小寫、符號都不能錯）。 */
export function ecpayText(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
