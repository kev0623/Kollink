import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLES_BUCKET, fileKindOf, fileLabel, SIGNED_URL_SECONDS, type FileKind } from "@/lib/deliverables";
import {
  revisionNotesByRound, toCollab, toCollabEvent, toCollabListItem, toSubmission,
  type Collab, type CollabEvent, type CollabListItem, type CollabListRow, type CollabRow, type CollabTab,
  type EventRow, type Submission, type SubmissionRow,
} from "./view";
import { PAYMENT_COLUMNS, type PaymentRow } from "@/lib/payments/view";

// 合作案的伺服器端讀取。全部用使用者自己的 client（definer 函式與 RLS 自己檢查身分）。
// 會讀 cookie：只能在 requireRole 之後呼叫。不快取。

/** 我的合作案（輪到我的在前；最多 200 筆）。 */
export async function loadMyCollabs(tab: CollabTab): Promise<CollabListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_collaborations", { p_tab: tab });
  if (error) throw error;
  return ((data ?? []) as unknown as CollabListRow[]).map(toCollabListItem);
}

export type SubmissionFile = { path: string; kind: FileKind; label: string; url: string | null };
export type SubmissionView = Submission & { files: SubmissionFile[]; revisionNotes: string[] };
/** payments：由新到舊最多 20 筆（RLS：參與者與管理員）；畫面用 summarizePayments 整理。 */
export type CollabDetailData = { collab: Collab; submissions: SubmissionView[]; events: CollabEvent[]; payments: PaymentRow[] };

/** 一個合作案的詳情；不是參與者（也不是管理員）或不存在回傳 null。檔案附 1 小時的 signed URL。 */
export async function loadCollabDetail(id: string): Promise<CollabDetailData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_collaboration", { p_id: id });
  if (error) throw error;
  const row = ((data ?? []) as unknown as CollabRow[])[0];
  if (!row) return null;
  const collab = toCollab(row);

  const [subsRes, eventsRes, paymentsRes] = await Promise.all([
    supabase.from("collaboration_submissions")
      .select("id, round, note, links, file_paths, created_at")
      .eq("collaboration_id", id).order("round", { ascending: true }),
    supabase.rpc("list_collaboration_events", { p_id: id }),
    supabase.from("payments").select(PAYMENT_COLUMNS)
      .eq("collaboration_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (subsRes.error) throw subsRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];
  const subs = ((subsRes.data ?? []) as unknown as SubmissionRow[]).map(toSubmission);
  const events = ((eventsRes.data ?? []) as unknown as EventRow[]).map(toCollabEvent);

  const paths = subs.flatMap((s) => s.filePaths);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: e3 } = await supabase.storage.from(DELIVERABLES_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (e3) throw e3;
    for (const s of signed ?? []) if (s.path && s.signedUrl && !s.error) urls.set(s.path, s.signedUrl);
  }
  const notes = revisionNotesByRound(subs, events);
  const submissions = subs.map((s) => ({
    ...s,
    files: s.filePaths.map((p, i) => ({ path: p, kind: fileKindOf(p), label: fileLabel(p, i), url: urls.get(p) ?? null })),
    revisionNotes: notes[s.round] ?? [],
  }));
  return { collab, submissions, events, payments };
}
