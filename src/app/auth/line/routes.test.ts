import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { seal } from "@/lib/auth/line/sealed-cookie";
import { claims, makeIdToken, TEST_CHANNEL_ID, TEST_CHANNEL_SECRET, TEST_SUB } from "@/lib/auth/line/test-helpers";

const m = vi.hoisted(() => ({
  rpc: vi.fn(), getUserById: vi.fn(), generateLink: vi.fn(), verifyOtp: vi.fn(), signOut: vi.fn(), getUser: vi.fn(), signInWithOtp: vi.fn(), postLoginPath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc, auth: { admin: { getUserById: m.getUserById, generateLink: m.generateLink } } }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: m.verifyOtp, signOut: m.signOut, getUser: m.getUser } }) }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ auth: { signInWithOtp: m.signInWithOtp } }) }));
vi.mock("@/lib/auth/after-login", () => ({ postLoginPath: m.postLoginPath }));

import { GET as start } from "./start/route";
import { GET as callback } from "./callback/route";
import { POST as link } from "./link/route";
import { GET as pending } from "./pending/route";

const SITE = "https://kollink.vercel.app";
const fetchMock = vi.fn();

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_LINE_AUTH_ENABLED", "true");
  vi.stubEnv("LINE_CHANNEL_ID", TEST_CHANNEL_ID);
  vi.stubEnv("LINE_CHANNEL_SECRET", TEST_CHANNEL_SECRET);
  vi.stubEnv("SITE_URL", SITE);
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.postLoginPath.mockResolvedValue("/brand");
  m.signInWithOtp.mockResolvedValue({ error: null });
  m.signOut.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function cookieFrom(res: Response, name: string): { value: string; header: string } | null {
  const all = res.headers.getSetCookie();
  const header = all.find((c) => c.startsWith(`${name}=`));
  if (!header) return null;
  return { value: decodeURIComponent(header.slice(name.length + 1).split(";")[0]), header };
}

/** 跑一次 /auth/line/start，回傳 cookie、state、nonce。 */
async function begin(query = "") {
  const res = await start(new NextRequest(`${SITE}/auth/line/start${query}`));
  const auth = new URL(res.headers.get("location")!);
  const flow = cookieFrom(res, "kl_line_flow")!;
  return { res, auth, flow, state: auth.searchParams.get("state")!, nonce: auth.searchParams.get("nonce")! };
}

function cb(query: string, cookie?: string, extraCookie = "") {
  const c = [cookie ? `kl_line_flow=${cookie}` : "", extraCookie].filter(Boolean).join("; ");
  return callback(new NextRequest(`${SITE}/auth/line/callback${query}`, { headers: c ? { cookie: c } : {} }));
}

function tokenResponse(nonce: string, extra: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  fetchMock.mockResolvedValueOnce(Response.json({ id_token: makeIdToken(claims(now, nonce, extra)), access_token: "at" }));
}

describe("GET /auth/line/start", () => {
  it("沒有設定：回登入頁 line_unavailable", async () => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "");
    const res = await start(new NextRequest(`${SITE}/auth/line/start`));
    expect(res.headers.get("location")).toBe("/login?error=line_unavailable");
  });
  it("正式環境沒有 SITE_URL：不使用請求的主機", async () => {
    vi.stubEnv("SITE_URL", "");
    const res = await start(new NextRequest(`${SITE}/auth/line/start`));
    expect(res.headers.get("location")).toBe("/login?error=line_unavailable");
  });
  it("導到 LINE；redirect_uri 用 SITE_URL；cookie HttpOnly、Secure、Lax、只送到 /auth/line、10 分鐘", async () => {
    const { res, auth, flow, state, nonce } = await begin("?role=creator&next=%2Fcreator%2Fme");
    expect(res.status).toBe(303);
    expect(auth.origin + auth.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(auth.searchParams.get("redirect_uri")).toBe(`${SITE}/auth/line/callback`);
    expect(auth.searchParams.get("scope")).toBe("openid profile email");
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(flow.header).toMatch(/HttpOnly/i);
    expect(flow.header).toMatch(/Secure/i);
    expect(flow.header).toMatch(/SameSite=lax/i);
    expect(flow.header).toMatch(/Path=\/auth\/line(;|$)/);
    expect(flow.header).toMatch(/Max-Age=600/);
    expect(flow.value).not.toContain(state);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
  it("請求主機跟 SITE_URL 不同：先換到 SITE_URL（next 清理過、role 白名單、no-store）", async () => {
    const res = await start(new NextRequest("https://kollink-git-x.vercel.app/auth/line/start?next=%2F%2Fevil.com&role=admin"));
    expect(res.headers.get("location")).toBe(`${SITE}/auth/line/start`);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(cookieFrom(res, "kl_line_flow")).toBeNull();
  });
});

describe("GET /auth/line/callback", () => {
  it("沒有 cookie（重放、過期、別的瀏覽器）：line_state，不換 token", async () => {
    const { state } = await begin();
    const res = await cb(`?code=c&state=${state}`);
    expect(res.headers.get("location")).toBe("/login?error=line_state");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("state 不符：line_state，清掉 cookie", async () => {
    const { flow } = await begin();
    const res = await cb("?code=c&state=wrong", flow.value);
    expect(res.headers.get("location")).toBe("/login?error=line_state");
    expect(cookieFrom(res, "kl_line_flow")?.header).toMatch(/Max-Age=0/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("使用者取消：line_cancelled", async () => {
    const { flow, state } = await begin();
    const res = await cb(`?error=access_denied&state=${state}`, flow.value);
    expect(res.headers.get("location")).toBe("/login?error=line_cancelled");
  });
  it("token 端點失敗：line_failed", async () => {
    const { flow, state } = await begin();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    const res = await cb(`?code=c&state=${state}`, flow.value);
    expect(res.headers.get("location")).toBe("/login?error=line_failed");
  });
  it("ID token nonce 不符（被替換的 token）：line_failed，不查帳號", async () => {
    const { flow, state } = await begin();
    tokenResponse("some-other-nonce");
    const res = await cb(`?code=c&state=${state}`, flow.value);
    expect(res.headers.get("location")).toBe("/login?error=line_failed");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("換 token 時送 redirect_uri 與 code_verifier", async () => {
    const { flow, state, nonce, auth } = await begin();
    tokenResponse(nonce, { email: undefined });
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: null, email_user_id: null }], error: null });
    await cb(`?code=thecode&state=${state}`, flow.value);
    const body = Object.fromEntries(fetchMock.mock.calls[0][1].body as URLSearchParams);
    expect(body).toMatchObject({ code: "thecode", redirect_uri: `${SITE}/auth/line/callback`, client_id: TEST_CHANNEL_ID });
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(body.code_verifier).digest("base64url")).toBe(auth.searchParams.get("code_challenge"));
  });
  it("已綁定：用 magiclink token 在伺服器換 session，照登入後規則導向", async () => {
    const { flow, state, nonce } = await begin("?role=brand&next=%2Fbrand%2Fbriefs");
    tokenResponse(nonce);
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: "user-1", email_user_id: "user-1" }], error: null });
    m.getUserById.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "owner@example.com" } }, error: null });
    m.generateLink.mockResolvedValueOnce({ data: { properties: { hashed_token: "hashed" } }, error: null });
    m.verifyOtp.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    m.postLoginPath.mockResolvedValueOnce("/brand/briefs");
    const res = await cb(`?code=c&state=${state}`, flow.value);
    expect(m.rpc).toHaveBeenCalledWith("line_login_lookup", { p_line_sub: TEST_SUB, p_email: "someone@example.com" });
    expect(m.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "owner@example.com" });
    expect(m.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "hashed" });
    expect(m.postLoginPath).toHaveBeenCalledWith(expect.anything(), "brand", "/brand/briefs");
    expect(res.headers.get("location")).toBe("/brand/briefs");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(m.signInWithOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).not.toContain("hashed");
  });
  it("沒綁定、沒有 Email：line_no_email，不建立帳號、不寄信", async () => {
    const { flow, state, nonce } = await begin();
    tokenResponse(nonce, { email: undefined });
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: null, email_user_id: null }], error: null });
    const res = await cb(`?code=c&state=${state}`, flow.value);
    expect(res.headers.get("location")).toBe("/login?error=line_no_email");
    expect(m.signInWithOtp).not.toHaveBeenCalled();
    expect(m.generateLink).not.toHaveBeenCalled();
  });
  it("Email 已有帳號：不登入、伺服器不寄信，帶加密綁定 cookie 到 /login?line=verify", async () => {
    const { flow, state, nonce } = await begin();
    tokenResponse(nonce);
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: null, email_user_id: "user-2" }], error: null });
    const res = await cb(`?code=c&state=${state}`, flow.value);
    expect(res.headers.get("location")).toBe("/login?line=verify");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(m.signInWithOtp).not.toHaveBeenCalled();
    expect(m.generateLink).not.toHaveBeenCalled();
    expect(m.verifyOtp).not.toHaveBeenCalled();
    expect(m.signOut).not.toHaveBeenCalled();
    const linkCookie = cookieFrom(res, "kl_line_link")!;
    expect(linkCookie.header).toMatch(/HttpOnly/i);
    const { unseal } = await import("@/lib/auth/line/sealed-cookie");
    expect(unseal(linkCookie.value, "link", TEST_CHANNEL_SECRET, Math.floor(Date.now() / 1000))).toMatchObject({ name: "測試", email: "someone@example.com" });
    expect(linkCookie.header).toMatch(/Path=\/auth\/line(;|$)/);
    expect(linkCookie.value).not.toContain("someone");
    expect(cookieFrom(res, "kl_line_flow")?.header).toMatch(/Max-Age=0/);
  });
  it("新的 Email：同一個中性的 /login?line=verify（不透露帳號是否存在）", async () => {
    const { flow, state, nonce } = await begin("?role=creator");
    tokenResponse(nonce);
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: null, email_user_id: null }], error: null });
    const res = await cb(`?code=c&state=${state}`, flow.value);
    expect(res.headers.get("location")).toBe("/login?line=verify");
    expect(m.signInWithOtp).not.toHaveBeenCalled();
  });
  it("這個瀏覽器已經登入別的帳號：先登出（否則 proxy 會把 /login 導走）", async () => {
    const { flow, state, nonce } = await begin();
    tokenResponse(nonce);
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: null, email_user_id: null }], error: null });
    const res = await cb(`?code=c&state=${state}`, flow.value, "sb-127-auth-token=abc");
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.headers.get("location")).toBe("/login?line=verify");
  });
  it("登出失敗時直接清掉 Supabase cookie", async () => {
    const { flow, state, nonce } = await begin();
    tokenResponse(nonce);
    m.rpc.mockResolvedValueOnce({ data: [{ linked_user_id: null, email_user_id: null }], error: null });
    m.signOut.mockResolvedValueOnce({ error: { message: "x" } });
    const res = await cb(`?code=c&state=${state}`, flow.value, "sb-127-auth-token=abc");
    expect(cookieFrom(res, "sb-127-auth-token")?.header).toMatch(/Max-Age=0/);
  });
  it("記錄不含 Email、LINE ID、授權碼", async () => {
    const { flow, state } = await begin();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 400 }));
    await cb(`?code=SECRETCODE&state=${state}`, flow.value);
    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRETCODE");
    expect(logged).not.toContain(TEST_SUB);
  });
});

describe("GET /auth/line/pending", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const get = (cookie: string | null, site: string | null = "same-origin") =>
    pending(new NextRequest(`${SITE}/auth/line/pending`, { headers: { ...(site ? { "sec-fetch-site": site } : {}), ...(cookie ? { cookie: `kl_line_link=${cookie}` } : {}) } }));
  const valid = () => seal("link", { sub: TEST_SUB, email: "someone@example.com", name: "小明", kind: "existing", uid: "user-2", next: null, role: null }, TEST_CHANNEL_SECRET, now() + 600);
  it("回傳這個瀏覽器自己的 LINE Email 與顯示名稱（不含 LINE ID、帳號 id）", async () => {
    const res = await get(valid());
    const body = await res.json();
    expect(body).toEqual({ email: "someone@example.com", name: "小明" });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
  it("沒有 cookie、過期、用途不對：expired", async () => {
    expect(await (await get(null)).json()).toEqual({ error: "expired" });
    const flow = seal("flow", { sub: TEST_SUB, email: "someone@example.com" }, TEST_CHANNEL_SECRET, now() + 600);
    expect(await (await get(flow)).json()).toEqual({ error: "expired" });
  });
  it("沒有 Sec-Fetch-Site（舊瀏覽器）：允許", async () => {
    expect(await (await get(valid(), null)).json()).toEqual({ email: "someone@example.com", name: "小明" });
  });
  it.each(["same-site", "cross-site"])("Sec-Fetch-Site=%s：403", async (site) => {
    const res = await get(valid(), site);
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("POST /auth/line/link（只綁定）", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const linkCookie = (over: Record<string, unknown> = {}) =>
    seal("link", { sub: TEST_SUB, email: "someone@example.com", kind: "existing", uid: "user-2", next: null, role: null, ...over }, TEST_CHANNEL_SECRET, now() + 600);
  const req = ({ cookie = linkCookie(), origin = SITE as string | null }: { cookie?: string | null; origin?: string | null } = {}) =>
    new NextRequest(`${SITE}/auth/line/link`, {
      method: "POST",
      headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie: `kl_line_link=${cookie}` } : {}) },
    });

  it("沒有 Origin 或跨站：403，不讀 session", async () => {
    expect((await link(req({ origin: null }))).status).toBe(403);
    expect((await link(req({ origin: "https://evil.example" }))).status).toBe(403);
    expect(m.getUser).not.toHaveBeenCalled();
  });
  it("沒有或過期的綁定 cookie：expired", async () => {
    expect(await (await link(req({ cookie: null }))).json()).toEqual({ error: "expired" });
    expect(m.getUser).not.toHaveBeenCalled();
  });
  it("沒有 session（還沒輸入驗證碼）：401，不綁定，保留 cookie", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await link(req());
    expect(res.status).toBe(401);
    expect(m.rpc).not.toHaveBeenCalled();
    expect(cookieFrom(res, "kl_line_link")).toBeNull();
  });
  it("登入的帳號 Email 不同：409、登出、清 cookie、不綁定", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: "user-2", email: "other@example.com" } }, error: null });
    const res = await link(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "mismatch" });
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(cookieFrom(res, "kl_line_link")?.header).toMatch(/Max-Age=0/);
  });
  it("Email 相同但不是查詢當下的帳號（uid 不符）：409、登出", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: "someone-else", email: "someone@example.com" } }, error: null });
    const res = await link(req());
    expect(res.status).toBe(409);
    expect(m.signOut).toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("同時寫入的競爭（conflict）：可以重試，保留 cookie", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: "user-2", email: "someone@example.com" } }, error: null });
    m.rpc.mockResolvedValueOnce({ data: "conflict", error: null });
    const res = await link(req());
    expect(await res.json()).toEqual({ error: "failed" });
    expect(cookieFrom(res, "kl_line_link")).toBeNull();
  });
  it("成功：綁定、清 cookie、回登入後路徑（管理員一樣經過 postLoginPath → /admin/mfa）", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: "user-2", email: "Someone@Example.com" } }, error: null });
    m.rpc.mockResolvedValueOnce({ data: "linked", error: null });
    m.postLoginPath.mockResolvedValueOnce("/admin/mfa");
    const res = await link(req());
    expect(m.rpc).toHaveBeenCalledWith("line_link_identity", { p_user_id: "user-2", p_line_sub: TEST_SUB });
    expect(await res.json()).toEqual({ redirect: "/admin/mfa" });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(cookieFrom(res, "kl_line_link")?.header).toMatch(/Max-Age=0/);
    expect(m.verifyOtp).not.toHaveBeenCalled();
    expect(m.signInWithOtp).not.toHaveBeenCalled();
  });
  it("新帳號（cookie 沒有 uid）：綁定剛建立的帳號，帶入選的身分", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: "new-user", email: "someone@example.com" } }, error: null });
    m.rpc.mockResolvedValueOnce({ data: "linked", error: null });
    m.postLoginPath.mockResolvedValueOnce("/onboarding/creator");
    const res = await link(req({ cookie: linkCookie({ kind: "new", uid: null, role: "creator" }) }));
    expect(m.rpc).toHaveBeenCalledWith("line_link_identity", { p_user_id: "new-user", p_line_sub: TEST_SUB });
    expect(m.postLoginPath).toHaveBeenCalledWith(expect.anything(), "creator", null);
    expect(await res.json()).toEqual({ redirect: "/onboarding/creator" });
  });
  it("這個帳號已綁定別的 LINE：不覆蓋，但照常登入", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: "user-2", email: "someone@example.com" } }, error: null });
    m.rpc.mockResolvedValueOnce({ data: "user_has_other", error: null });
    expect(await (await link(req())).json()).toEqual({ redirect: "/brand" });
  });
});
