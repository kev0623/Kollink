// 綠界 server-to-server 通知的共用小工具：讀表單、回純文字。

/** 讀 x-www-form-urlencoded 表單成字串物件；不是表單（或壞掉）回傳 null。 */
export async function readEcpayForm(request: Request): Promise<Record<string, string> | null> {
  try {
    const form = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params[key] = value;
    }
    return params;
  } catch {
    return null;
  }
}

/** 綠界要求回應純文字 1|OK（大小寫、符號都不能錯）。 */
export function ecpayText(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
