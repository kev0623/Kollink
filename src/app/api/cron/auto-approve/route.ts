import { isAuthorizedCron } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type AutoApproveRow = { approved: number | null; failed: string[] | null };

/**
 * 審核逾期自動通過（Vercel Cron，vercel.json：每天 UTC 01:00 = 台灣 09:00）。
 * 只接受 `Authorization: Bearer ${CRON_SECRET}`；以 service_role 呼叫 auto_approve_due()（transition_collaboration 判定為 system）。
 * 讀 request.headers，所以這個 GET 一定在請求時執行（cacheComponents 下不會被預渲染）。
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("cron auto-approve: CRON_SECRET is not set");
    return Response.json({ error: "not configured" }, { status: 500 });
  }
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { data, error } = await createAdminClient().rpc("auto_approve_due");
    if (error) {
      console.error("cron auto-approve: rpc failed", { code: error.code, message: error.message });
      return Response.json({ error: "rpc failed" }, { status: 500 });
    }
    const row = ((data ?? []) as unknown as AutoApproveRow[])[0];
    const approved = row?.approved ?? 0;
    const failed = row?.failed ?? [];
    if (failed.length > 0) console.error("cron auto-approve: some collaborations failed", { failed });
    console.info("cron auto-approve: done", { approved, failed: failed.length });
    return Response.json({ approved, failed });
  } catch (e) {
    console.error("cron auto-approve: unhandled error", e);
    return Response.json({ error: "error" }, { status: 500 });
  }
}
