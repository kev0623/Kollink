import { relativeRedirect } from "@/lib/auth/relative-redirect";
import { isUuid } from "@/lib/briefs/query";

/**
 * 信用卡付款完成後，綠界讓瀏覽器 POST 回來（OrderResultURL）。
 * 這是瀏覽器送的、可以被偽造：完全不讀內容、不改任何狀態，只把品牌導回合作案詳情（GET）。
 * 付款狀態一律以 ReturnURL（notify）為準。
 */
function back(request: Request): Response {
  const c = new URL(request.url).searchParams.get("c");
  return relativeRedirect(isUuid(c) ? `/brand/collabs/${c}` : "/brand/collabs", 303);
}

export async function POST(request: Request): Promise<Response> {
  return back(request);
}

export async function GET(request: Request): Promise<Response> {
  return back(request);
}
