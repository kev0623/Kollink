// 瀏覽器端（LineLinkForm）解析 GET /auth/line/pending 的回應。不 import 任何伺服器模組。

export type PendingViewData = { email: string; name: string | null };

const MAX_NAME = 40;

export function parsePendingResponse(body: unknown): PendingViewData | null {
  if (!body || typeof body !== "object") return null;
  const { email, name } = body as { email?: unknown; name?: unknown };
  if (typeof email !== "string" || !email.includes("@") || email.length > 254) return null;
  const n = typeof name === "string" ? Array.from(name).slice(0, MAX_NAME).join("").trim() : "";
  return { email, name: n || null };
}
