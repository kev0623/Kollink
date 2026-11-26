"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/briefs/query";
import { collabErrorMessage, collabFieldError } from "@/lib/collabs/errors";
import { buildCheckoutForm, isPaymentMethod, type CheckoutForm } from "@/lib/payments/checkout";
import { readEcpayConfig } from "@/lib/payments/config";
import { cleanLongText, parseAmount, parseOfferForm, validateOffer, validateRevisionNote } from "@/lib/validation/collab";

const BAD_INPUT = "資料格式不正確，請重新整理頁面";

export type OfferFormState = { fieldErrors?: Record<string, string>; formError?: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCollab(id: string) {
  revalidatePath("/brand/collabs");
  revalidatePath("/creator/collabs");
  revalidatePath(`/brand/collabs/${id}`);
  revalidatePath(`/creator/collabs/${id}`);
}

/** 在創作者公開頁直接邀請（invited）。成功後導到合作案詳情。 */
export async function inviteCreatorAction(_prev: OfferFormState, fd: FormData): Promise<OfferFormState> {
  await requireRole("brand");
  const creatorId = fd.get("creatorId");
  if (!isUuid(creatorId)) return { formError: BAD_INPUT };
  const input = parseOfferForm(fd);
  const fieldErrors = validateOffer(input, true);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_creator", {
    p_creator_id: creatorId,
    p_title: input.title,
    p_deliverables: input.deliverables,
    p_amount_twd: parseAmount(input.amount)!,
  });
  if (error) {
    const fe = collabFieldError(error);
    return fe ? { fieldErrors: fe } : { formError: collabErrorMessage(error) };
  }
  const id = data as unknown as string;
  revalidateCollab(id);
  redirect(`/brand/collabs/${id}`);
}

const BRAND_ACTIONS: readonly string[] = ["cancel", "approve", "request_changes"];

/** 品牌的狀態動作：取消（邀約中／待付款）、審核通過、要求修改（說明必填）。 */
export async function brandCollabAction(collabId: unknown, action: unknown, note?: unknown): Promise<ActionResult> {
  await requireRole("brand");
  if (!isUuid(collabId) || typeof action !== "string" || !BRAND_ACTIONS.includes(action)) return { ok: false, error: BAD_INPUT };
  let cleanNote: string | null = null;
  if (action === "request_changes") {
    if (typeof note !== "string") return { ok: false, error: BAD_INPUT };
    cleanNote = cleanLongText(note);
    const err = validateRevisionNote(cleanNote);
    if (err) return { ok: false, error: err };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_collaboration", {
    p_collab_id: collabId,
    p_action: action,
    ...(cleanNote !== null ? { p_note: cleanNote } : {}),
  });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  revalidateCollab(collabId);
  return { ok: true };
}

export type StartPaymentResult = { ok: true; form: CheckoutForm } | { ok: false; error: string };
type PaymentOrderRow = { merchant_trade_no: string | null; amount_twd: number | null; created_at: string | null };

// "use server" 檔案只能 export async 函式：常數不 export
const PAYMENT_UNAVAILABLE = "線上付款尚未開放，請聯絡平台";

/**
 * 「確認並付款」：以品牌自己的 client 呼叫 create_payment_order（資料庫檢查身分、狀態、金額、頻率，並產生付款單編號），
 * 再由伺服器組好綠界表單與 CheckMacValue 回傳；瀏覽器只負責把表單 POST 到綠界。金鑰不會離開伺服器。
 * 每次都建立新的付款單（綠界不接受重複的 MerchantTradeNo）。
 */
export async function startPaymentAction(collabId: unknown, method: unknown): Promise<StartPaymentResult> {
  await requireRole("brand");
  if (!isUuid(collabId) || !isPaymentMethod(method)) return { ok: false, error: BAD_INPUT };
  const config = readEcpayConfig();
  if (!config) return { ok: false, error: PAYMENT_UNAVAILABLE };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payment_order", { p_collab_id: collabId, p_method: method });
  if (error) return { ok: false, error: collabErrorMessage(error) };
  const row = ((data ?? []) as unknown as PaymentOrderRow[])[0];
  const createdAt = row?.created_at ? new Date(row.created_at) : null;
  if (!row?.merchant_trade_no || !row.amount_twd || !createdAt || Number.isNaN(createdAt.getTime())) {
    return { ok: false, error: "發生錯誤，請稍後再試" };
  }
  revalidateCollab(collabId);
  return {
    ok: true,
    form: buildCheckoutForm({
      config, merchantTradeNo: row.merchant_trade_no, amountTwd: row.amount_twd, method, collabId, createdAt,
    }),
  };
}
