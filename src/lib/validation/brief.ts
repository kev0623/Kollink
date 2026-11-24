// 規則與 supabase/migrations/20261124000500_briefs.sql 的 save_brief、apply_to_brief 一致；資料庫是最後防線。
import { addDays, isIsoDate, MAX_DEADLINE_DAYS } from "@/lib/briefs/dates";
import { MAX_PRICE_TWD } from "./creator-profile";
import { cleanText, cleanTextWithin, hasBidi } from "./onboarding";

export const MAX_FOLLOWERS = 100_000_000;
const BAD_CHAR_MESSAGE = "含有不允許的特殊字元";
// 只檢查格式；「必須在自己的資料夾」由資料庫的 check_media_path 檢查
const COVER_PATH_RE = /^[0-9a-f-]{36}\/cover-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * 雙向控制字元或 NUL。NUL（U+0000）不能存進 Postgres text（PostgREST 會回 22P05），
 * 資料庫端根本收不到，所以只能在這裡擋（followups「NUL」一項）。
 */
export function hasBadChar(v: string): boolean {
  return hasBidi(v) || v.includes("\u0000");
}

/** 字數（與 Postgres char_length 一致，以 code point 計算）。 */
function len(v: string): number {
  return [...v].length;
}

/** 數字欄位：去掉千分位逗號與空白。 */
function digits(v: string): string {
  return cleanText(v).replace(/[,，\s]/g, "");
}

/** 前端檢查用：數字欄位和伺服器一樣先去掉千分位逗號與空白（避免「5,000」在前端被擋、送到伺服器卻可以）。 */
export function normalizeBriefNumbers(i: BriefInput): BriefInput {
  return { ...i, minFollowers: digits(i.minFollowers), budgetMin: digits(i.budgetMin), budgetMax: digits(i.budgetMax) };
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function strings(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

/** 表單上的招募內容（全部是使用者輸入的文字，數字欄位空字串代表沒填）。 */
export type BriefInput = {
  title: string;
  description: string;
  collabTypes: string[];
  coverPath: string | null;
  categories: string[];
  minFollowers: string;
  region: string;
  budgetMin: string;
  budgetMax: string;
  includesProduct: boolean;
  deadline: string;
};

/** reward 是「預算和產品至少要有一項」，顯示在第 3 步。 */
export type BriefField = Exclude<keyof BriefInput, "includesProduct"> | "reward";
export type BriefStep = 1 | 2 | 3 | 4;

export const BRIEF_STEP_FIELDS: Record<1 | 2 | 3, BriefField[]> = {
  1: ["title", "description", "collabTypes", "coverPath"],
  2: ["categories", "minFollowers", "region"],
  3: ["budgetMin", "budgetMax", "reward", "deadline"],
};

export const EMPTY_BRIEF_INPUT: BriefInput = {
  title: "", description: "", collabTypes: [], coverPath: null, categories: [], minFollowers: "",
  region: "", budgetMin: "", budgetMax: "", includesProduct: false, deadline: "",
};

/** 說明的截斷長度：8000 個 UTF-16 單位至少 4000 字，必然超過 2000 字上限。 */
const DESCRIPTION_RAW_LIMIT = 8000;
/** 報名留言的截斷長度：2000 個單位至少 1000 字，必然超過 500 字上限。 */
const MESSAGE_RAW_LIMIT = 2000;

export function parseBriefForm(fd: FormData): BriefInput {
  const cover = cleanText(str(fd, "coverPath"));
  return {
    title: cleanText(str(fd, "title")),
    description: cleanTextWithin(str(fd, "description").replace(/\r\n?/g, "\n"), DESCRIPTION_RAW_LIMIT),
    collabTypes: strings(fd, "collabTypes").map(cleanText),
    coverPath: cover || null,
    categories: strings(fd, "categories").map(cleanText),
    minFollowers: digits(str(fd, "minFollowers")),
    region: cleanText(str(fd, "region")),
    budgetMin: digits(str(fd, "budgetMin")),
    budgetMax: digits(str(fd, "budgetMax")),
    includesProduct: fd.get("includesProduct") === "on",
    deadline: cleanText(str(fd, "deadline")),
  };
}

function listError(list: string[], maxCount: number, maxLen: number): boolean {
  return list.length > maxCount
    || list.some((t) => hasBadChar(t) || len(t) < 1 || len(t) > maxLen)
    || new Set(list).size !== list.length;
}

function priceOk(v: string): boolean {
  return /^\d{1,8}$/.test(v) && Number(v) <= MAX_PRICE_TWD;
}

/** 預算：空字串與 0 都是「沒填」（與資料庫 nullif(…, 0) 一致）。 */
function budgetValue(v: string): number {
  return priceOk(v) ? Number(v) : 0;
}

/**
 * draft：只檢查格式（草稿可以缺必填）；publish：再檢查必填、預算或產品、截止日（今天到 90 天內）。
 * 錯誤的 key 是 BriefField。
 */
export function validateBrief(i: BriefInput, mode: "draft" | "publish", today: string): Record<string, string> | null {
  const e: Record<string, string> = {};
  const publish = mode === "publish";

  if (hasBadChar(i.title)) e.title = BAD_CHAR_MESSAGE;
  else if (len(i.title) > 60) e.title = "案名最多 60 字";
  else if (publish && i.title === "") e.title = "請填寫案名（60 字以內）";

  if (hasBadChar(i.description)) e.description = BAD_CHAR_MESSAGE;
  else if (len(i.description) > 2000) e.description = "說明最多 2000 字";
  else if (publish && i.description === "") e.description = "請填寫合作說明";

  if (listError(i.collabTypes, 6, 20)) e.collabTypes = "請重新選擇合作形式";
  else if (publish && i.collabTypes.length === 0) e.collabTypes = "請至少選一種合作形式";

  if (i.coverPath !== null && (!COVER_PATH_RE.test(i.coverPath) || i.coverPath.includes(".."))) {
    e.coverPath = "封面圖片有問題，請重新上傳";
  }

  if (listError(i.categories, 5, 30)) e.categories = "最多選 5 個內容領域";

  if (i.minFollowers !== "" && !(/^\d{1,9}$/.test(i.minFollowers) && Number(i.minFollowers) <= MAX_FOLLOWERS)) {
    e.minFollowers = "請填 0 以上的整數";
  }

  if (hasBadChar(i.region) || len(i.region) > 30) e.region = "請重新選擇地區";

  if (i.budgetMin !== "" && !priceOk(i.budgetMin)) e.budgetMin = "請填 0 到 10,000,000 的整數";
  if (i.budgetMax !== "" && !priceOk(i.budgetMax)) e.budgetMax = "請填 0 到 10,000,000 的整數";
  const min = budgetValue(i.budgetMin);
  const max = budgetValue(i.budgetMax);
  if (!e.budgetMin && !e.budgetMax && max > 0 && max < min) e.budgetMax = "上限不能低於下限";
  if (publish && min === 0 && max === 0 && !i.includesProduct) e.reward = "預算和產品至少要有一項";

  if (i.deadline !== "" && !isIsoDate(i.deadline)) {
    e.deadline = "日期格式不正確";
  } else if (publish) {
    if (i.deadline === "") e.deadline = "請選擇截止日";
    else if (i.deadline < today || i.deadline > addDays(today, MAX_DEADLINE_DAYS)) {
      e.deadline = `截止日要在今天到 ${MAX_DEADLINE_DAYS} 天內`;
    }
  }
  return Object.keys(e).length ? e : null;
}

/** 按「下一步」時只檢查這一步的欄位（必填也檢查）；第 4 步檢查全部。 */
export function validateBriefStep(step: BriefStep, i: BriefInput, today: string): Record<string, string> | null {
  const all = validateBrief(i, "publish", today);
  if (!all || step === 4) return all;
  const fields: string[] = BRIEF_STEP_FIELDS[step];
  const picked = Object.fromEntries(Object.entries(all).filter(([k]) => fields.includes(k)));
  return Object.keys(picked).length ? picked : null;
}

/** 有錯誤的欄位中，最前面的那一步（送出失敗時跳過去）。 */
export function firstErrorStep(errors: Record<string, string>): BriefStep {
  for (const step of [1, 2, 3] as const) {
    if (BRIEF_STEP_FIELDS[step].some((f) => f in errors)) return step;
  }
  return 4;
}

/** save_brief 的參數。空字串 → null；預算 0 由資料庫轉成 null。 */
export function toSaveBriefArgs(id: string | null, i: BriefInput, publish: boolean) {
  return {
    p_id: id ?? undefined,
    p_title: i.title,
    p_description: i.description,
    p_collab_types: i.collabTypes,
    p_categories: i.categories,
    p_min_followers: i.minFollowers === "" ? 0 : Number(i.minFollowers),
    p_region: i.region,
    p_budget_min_twd: i.budgetMin === "" ? undefined : Number(i.budgetMin),
    p_budget_max_twd: i.budgetMax === "" ? undefined : Number(i.budgetMax),
    p_includes_product: i.includesProduct,
    p_deadline: i.deadline === "" ? undefined : i.deadline,
    p_cover_path: i.coverPath ?? undefined,
    p_publish: publish,
  };
}

export type ApplicationInput = { briefId: string; message: string; proposedPrice: string };

export function parseApplicationForm(fd: FormData): ApplicationInput {
  return {
    briefId: cleanText(str(fd, "briefId")),
    message: cleanTextWithin(str(fd, "message").replace(/\r\n?/g, "\n"), MESSAGE_RAW_LIMIT),
    proposedPrice: digits(str(fd, "proposedPrice")),
  };
}

export function validateApplication(i: ApplicationInput): Record<string, string> | null {
  const e: Record<string, string> = {};
  if (hasBadChar(i.message)) e.message = BAD_CHAR_MESSAGE;
  else if (len(i.message) > 500) e.message = "最多 500 字";
  if (i.proposedPrice !== "" && !priceOk(i.proposedPrice)) e.proposedPrice = "請填 0 到 10,000,000 的整數";
  return Object.keys(e).length ? e : null;
}
