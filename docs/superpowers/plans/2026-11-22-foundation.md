# 地基（Foundation）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建好 Next.js 專案骨架與設計 token，並把核心資料表、RLS、合作狀態機（含 audit log）、綠界付款通知驗簽一次做好，之後所有功能都建立在這層上。

**Architecture:** Next.js（App Router、TypeScript）單一 repo。資料庫是 Supabase Postgres，**schema 以 Supabase SQL migration 為唯一來源**（不使用 Drizzle：RLS、trigger、security definer function 都是 SQL，用兩套 migration 工具反而容易不同步）。合作狀態變更**只能**透過資料庫函式 `transition_collaboration`，它在同一個 transaction 裡檢查權限、改狀態、寫 audit log；前端和 API 都不能直接 UPDATE 狀態欄位。金流通知的處理邏輯寫成不依賴框架的純函式（依賴從外部注入），route handler 只負責把外部依賴接上。

**Tech Stack:** Next.js（`create-next-app@latest`）、TypeScript、Tailwind CSS v4、Vitest、Supabase CLI（本機 Postgres + pgTAP）、`@supabase/supabase-js`、GitHub Actions。

**之後的計畫（不在本份範圍）：** 2. 登入與註冊（選擇身分、建立檔案）→ 3. 創作者公開檔案頁 → 4. 創作者廣場 → 5. 招募與機會頁 → 6. 合作案詳情頁 → 7. 站內訊息與聯絡方式偵測 → 8. 付款建單與撥款 → 9. 管理後台 → 10. 審核逾期自動通過的排程。

## Global Constraints

- 設計規格：`docs/superpowers/specs/2026-11-22-ui-design.md`
- 色彩 token（逐字照抄）：primary `#E8684A`、primary-soft `#FCE9E2`、bg `#FBF7F2`、surface `#FFFFFF`、ink `#2B2522`、muted `#8A7F78`、line `#EFE6DE`、success `#3E8E6A`、success-soft `#E6F2EC`
- 字體：Noto Sans TC；`<html lang="zh-Hant">`；MVP 不做暗色模式
- 合作狀態（enum `collab_status`）：`invited`、`awaiting_payment`、`awaiting_submission`、`in_review`、`awaiting_publish`、`awaiting_payout`、`completed`、`declined`、`cancelled`
- 品牌交稿後審核期限：**3 天**（`in_review` 時設定 `review_due_at = now() + interval '3 days'`）
- 所有 `public` 資料表都必須 `enable row level security`
- `SUPABASE_SERVICE_ROLE_KEY` 只能在伺服器端使用；不可出現在 `NEXT_PUBLIC_*` 變數或任何 client component
- `audit_logs` 只能新增：所有角色都不能 UPDATE / DELETE（另以 trigger 擋下）
- 金流供應商（MVP）：綠界 ECPay；通知回應成功時必須回傳純文字 `1|OK`
- 前置需求：Node.js 22、Docker Desktop（Supabase 本機環境需要）
- Git：每個 Task 結束時 commit；整份計畫完成後 `git push`

---

## 檔案結構

```
src/
  app/
    layout.tsx                         # 字體、lang、全域樣式
    page.tsx                           # 暫時的首頁（展示 token）
    globals.css                        # Tailwind v4 + 設計 token
    api/payments/ecpay/notify/route.ts # 綠界付款通知入口（薄的外殼）
  lib/
    env.ts                             # requireEnv()
    env.test.ts
    supabase/admin.ts                  # service role client（server-only）
    payments/
      ecpay.ts                         # CheckMacValue 計算與驗證
      ecpay.test.ts
      ecpay-notify.ts                  # 付款通知處理（純函式 + 依賴注入）
      ecpay-notify.test.ts
supabase/
  config.toml
  migrations/
    20261122000100_profiles.sql
    20261122000200_briefs_messaging.sql
    20261122000300_collaborations.sql
    20261122000400_payments.sql
  tests/
    01_profiles_rls.test.sql
    02_briefs_messaging_rls.test.sql
    03_collaborations.test.sql
    04_payments.test.sql
.github/workflows/ci.yml
.env.example
vitest.config.ts
```

---

### Task 1：Next.js 骨架、設計 token、Vitest

**Files:**
- Create: Next.js 專案檔（由 `create-next-app` 產生）
- Create: `vitest.config.ts`, `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `package.json`, `.gitignore`

**Interfaces:**
- Produces: `requireEnv(name: string): string`（`src/lib/env.ts`）；Tailwind 工具類別 `bg-bg`、`bg-surface`、`text-ink`、`text-muted`、`bg-primary`、`text-primary`、`bg-primary-soft`、`border-line`、`text-success`、`bg-success-soft`、`rounded-card`、`rounded-btn`

- [ ] **Step 1：在暫存資料夾產生 Next.js 專案後搬進 repo**

repo 裡已經有 `README.md`、`.gitignore`、`docs/`，直接在這裡執行 `create-next-app` 可能會因為檔案衝突而失敗，所以先在子資料夾產生再搬過來。

```bash
cd /Users/kai-chun/Developer/Kollink
npx create-next-app@latest next-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude .git --exclude README.md next-scaffold/ ./
rm -rf next-scaffold
printf '\n# brainstorm companion\n.superpowers/\n' >> .gitignore
```

Expected：根目錄出現 `package.json`、`src/app/`、`next.config.ts`；`.gitignore` 最後一行是 `.superpowers/`。

- [ ] **Step 2：安裝 Vitest 並設定 scripts**

```bash
npm i -D vitest
npm pkg set scripts.test="vitest run"
npm pkg set scripts.typecheck="tsc --noEmit"
```

建立 `vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3：寫 `requireEnv` 的失敗測試**

`src/lib/env.test.ts`：

```ts
import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => {
    delete process.env.POLLEN_TEST_VAR;
  });

  it("returns the value when set", () => {
    process.env.POLLEN_TEST_VAR = "hello";
    expect(requireEnv("POLLEN_TEST_VAR")).toBe("hello");
  });

  it("throws with the variable name when missing", () => {
    expect(() => requireEnv("POLLEN_TEST_VAR")).toThrow("Missing env POLLEN_TEST_VAR");
  });

  it("treats empty string as missing", () => {
    process.env.POLLEN_TEST_VAR = "";
    expect(() => requireEnv("POLLEN_TEST_VAR")).toThrow("Missing env POLLEN_TEST_VAR");
  });
});
```

- [ ] **Step 4：執行測試，確認失敗**

Run: `npm test`
Expected: FAIL，錯誤是找不到 `./env`。

- [ ] **Step 5：實作 `requireEnv`**

`src/lib/env.ts`：

```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}
```

- [ ] **Step 6：執行測試，確認通過**

Run: `npm test`
Expected: 3 passed。

- [ ] **Step 7：寫入設計 token**

用以下內容**完整取代** `src/app/globals.css`（移除 create-next-app 預設的暗色模式設定）：

```css
@import "tailwindcss";

@theme {
  --color-primary: #E8684A;
  --color-primary-soft: #FCE9E2;
  --color-bg: #FBF7F2;
  --color-surface: #FFFFFF;
  --color-ink: #2B2522;
  --color-muted: #8A7F78;
  --color-line: #EFE6DE;
  --color-success: #3E8E6A;
  --color-success-soft: #E6F2EC;

  --radius-card: 12px;
  --radius-btn: 10px;

  --font-sans: var(--font-noto-sans-tc), system-ui, sans-serif;
}

body {
  background: var(--color-bg);
  color: var(--color-ink);
}
```

用以下內容取代 `src/app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-tc",
  preload: false,
});

export const metadata: Metadata = {
  title: "Pollen",
  description: "台灣品牌 × 創作者合作平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={notoSansTC.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

用以下內容取代 `src/app/page.tsx`：

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Pollen</h1>
      <p className="mt-2 text-muted">品牌 × 創作者合作平台，即將推出。</p>
      <div className="mt-8 rounded-card bg-surface p-6 shadow-sm border border-line">
        <p className="font-bold text-primary">設計 token 檢查</p>
        <span className="mt-3 inline-block rounded-btn bg-primary px-4 py-2 font-bold text-white">
          主要按鈕
        </span>
        <span className="ml-2 inline-block rounded-full bg-success-soft px-3 py-1 text-sm text-success">
          ✓ 符合你的條件
        </span>
      </div>
    </main>
  );
}
```

- [ ] **Step 8：建立 `.env.example`**

```bash
cat > .env.example <<'EOF'
# Supabase（本機用 `npx supabase status` 查看）
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# 只能在伺服器端使用，絕對不要加 NEXT_PUBLIC_ 前綴
SUPABASE_SERVICE_ROLE_KEY=

# 綠界 ECPay（測試環境的值請見綠界技術文件）
ECPAY_HASH_KEY=
ECPAY_HASH_IV=
EOF
```

確認 `.gitignore` 有排除 `.env*` 但沒有排除 `.env.example`：

Run: `git check-ignore .env.local .env.example; echo "exit=$?"`
Expected: 只印出 `.env.local`。如果 `.env.example` 也被印出來，在 `.gitignore` 加一行 `!.env.example`。

- [ ] **Step 9：確認可以建置**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: 三個指令都成功結束（exit 0）。

- [ ] **Step 10：Commit**

```bash
git add -A
git status --short   # 確認沒有 .env.local 或 node_modules
git commit -m "地基 Task 1：Next.js 骨架、設計 token、Vitest"
```

---

### Task 2：Supabase 本機環境 + 帳號與檔案資料表 + RLS

**Files:**
- Create: `supabase/config.toml`（由 `supabase init` 產生）
- Create: `supabase/migrations/20261122000100_profiles.sql`
- Test: `supabase/tests/01_profiles_rls.test.sql`
- Modify: `package.json`

**Interfaces:**
- Produces（SQL）：enum `public.user_role ('brand','creator')`；資料表 `public.profiles`、`public.admins`、`public.brand_profiles`、`public.creator_profiles`、`public.creator_rates`；函式 `public.is_admin() returns boolean`、`public.my_role() returns public.user_role`

- [ ] **Step 1：初始化 Supabase 並啟動本機資料庫**

```bash
npm i -D supabase
npx supabase init
npx supabase start
npm pkg set scripts.test:db="supabase test db"
```

Expected：`supabase start` 印出 `API URL: http://127.0.0.1:54321` 等資訊（需要 Docker 正在執行）。

- [ ] **Step 2：寫 RLS 測試（先寫測試）**

`supabase/tests/01_profiles_rls.test.sql`：

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- 測試資料（以 postgres 身分建立，不受 RLS 限制）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');

insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000c2', 'creator', '阿明');

insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物');

insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved'),
  ('00000000-0000-0000-0000-0000000000c2', 'ming', 'ming.ig', 'pending');

insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-0000000000c1', 'ig_post', 4500);

-- 未登入訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.creator_profiles), 1,
  '訪客只看得到已審核通過的創作者');
select is((select count(*)::int from public.creator_rates), 0,
  '訪客看不到報價');

-- 品牌 b1
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is((select count(*)::int from public.creator_rates), 1,
  '品牌看得到報價');

-- 創作者 c2（尚未審核）
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

select is((select count(*)::int from public.creator_rates), 0,
  '創作者看不到其他創作者的報價');
select is(
  (select count(*)::int from public.creator_profiles
     where user_id = '00000000-0000-0000-0000-0000000000c2'),
  1, '創作者看得到自己尚未審核的檔案');
select throws_ok(
  $$update public.creator_profiles set status = 'approved' where user_id = auth.uid()$$,
  '42501', null, '創作者不能自己把狀態改成已審核');
select throws_ok(
  $$update public.profiles set role = 'brand' where id = auth.uid()$$,
  '42501', null, '使用者不能更改自己的身分');

select * from finish();
rollback;
```

- [ ] **Step 3：執行測試，確認失敗**

Run: `npm run test:db`
Expected: FAIL，錯誤包含 `relation "public.profiles" does not exist`。

- [ ] **Step 4：寫 migration**

`supabase/migrations/20261122000100_profiles.sql`：

```sql
-- 帳號身分與檔案

create type public.user_role as enum ('brand', 'creator');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- 平台管理員（只能用 SQL / Supabase Studio 新增，沒有任何 API 權限）
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;

create table public.brand_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  brand_name text not null,
  industry text,
  logo_url text,
  created_at timestamptz not null default now()
);
-- 統編等開票資料在「付款建單與撥款」計畫另建私有資料表，不放在這張公開可讀的表

create table public.creator_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  ig_username text not null,
  follower_count integer not null default 0 check (follower_count >= 0),
  engagement_rate numeric(5, 2) check (engagement_rate between 0 and 100),
  region text,
  categories text[] not null default '{}',
  style_tags text[] not null default '{}',
  collab_types text[] not null default '{}',
  bio text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now()
);

-- 報價獨立成一張表，才能用 RLS 做到「只有品牌看得到報價」
create table public.creator_rates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  collab_type text not null,
  price_twd integer not null check (price_twd >= 0),
  unique (creator_id, collab_type)
);

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.creator_rates enable row level security;

-- profiles：登入者可以看到所有人的名稱和身分（對話、合作頁需要）；只能改自己的 display_name
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- admins：不開放任何 policy（API 完全讀寫不到）

-- brand_profiles
create policy brand_profiles_select on public.brand_profiles
  for select to authenticated using (true);
create policy brand_profiles_insert_self on public.brand_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() = 'brand');
create policy brand_profiles_update_self on public.brand_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- creator_profiles：已審核的公開給所有人（公開檔案頁）；自己和管理員看得到全部
create policy creator_profiles_select on public.creator_profiles
  for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy creator_profiles_insert_self on public.creator_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() = 'creator' and status = 'pending');
create policy creator_profiles_update_self on public.creator_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.creator_profiles from anon, authenticated;
grant update (ig_username, follower_count, engagement_rate, region, categories,
              style_tags, collab_types, bio)
  on public.creator_profiles to authenticated;

-- creator_rates：品牌、本人、管理員看得到；本人可以增刪改
create policy creator_rates_select on public.creator_rates
  for select to authenticated
  using (creator_id = auth.uid() or public.my_role() = 'brand' or public.is_admin());
create policy creator_rates_write_own on public.creator_rates
  for all to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
```

- [ ] **Step 5：套用 migration 並執行測試**

Run: `npx supabase db reset && npm run test:db`
Expected: `01_profiles_rls.test.sql .. ok`，`All tests successful.`

- [ ] **Step 6：Commit**

```bash
git add supabase package.json package-lock.json
git commit -m "地基 Task 2：Supabase 本機環境、帳號與檔案資料表、RLS"
```

---

### Task 3：招募、報名、對話、訊息資料表 + RLS

**Files:**
- Create: `supabase/migrations/20261122000200_briefs_messaging.sql`
- Test: `supabase/tests/02_briefs_messaging_rls.test.sql`

**Interfaces:**
- Consumes: `public.profiles`、`public.brand_profiles`、`public.creator_profiles`、`public.is_admin()`、`public.my_role()`（Task 2）
- Produces（SQL）：資料表 `public.briefs`、`public.brief_applications`、`public.conversations`、`public.messages`；函式 `public.is_conversation_participant(p_conversation_id uuid) returns boolean`

- [ ] **Step 1：寫測試**

`supabase/tests/02_briefs_messaging_rls.test.sql`：

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', 'brand', '森林寵物食堂'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', '森林寵物食堂');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');

insert into public.briefs (id, brand_id, title, description, deadline, status) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b1',
   '春季新品開箱', 'IG 貼文 + 限動', current_date + 7, 'open'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000b1',
   '已截止的招募', '舊案', current_date - 1, 'closed');

insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b1', '您好，想邀請您合作');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.briefs), 0, '訪客看不到招募');

-- 品牌 b2（第三方）
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 0, '第三方看不到別人的訊息');
select is((select count(*)::int from public.conversations), 0, '第三方看不到別人的對話');
select is((select count(*)::int from public.briefs), 1, '其他品牌只看得到開放中的招募');
select throws_ok(
  $$insert into public.messages (conversation_id, body)
    values ('00000000-0000-0000-0000-00000000a001', '插話')$$,
  '42501', null, '第三方不能在別人的對話裡發訊息');

-- 創作者 c1
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 1, '對話參與者看得到訊息');
select lives_ok(
  $$insert into public.messages (conversation_id, body)
    values ('00000000-0000-0000-0000-00000000a001', '謝謝，我有興趣！')$$,
  '對話參與者可以發訊息');
select throws_ok(
  $$insert into public.messages (conversation_id, body, flagged_contact)
    values ('00000000-0000-0000-0000-00000000a001', 'x', false)$$,
  '42501', null, '使用者不能自己設定違規標記');
select lives_ok(
  $$insert into public.brief_applications (brief_id, creator_id, message)
    values ('00000000-0000-0000-0000-00000000f001', auth.uid(), '我想報名')$$,
  '創作者可以報名開放中的招募');
select throws_ok(
  $$insert into public.brief_applications (brief_id, creator_id, message)
    values ('00000000-0000-0000-0000-00000000f002', auth.uid(), '我想報名')$$,
  '42501', null, '創作者不能報名已截止的招募');

-- 品牌 b1（招募主）與 b2
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.brief_applications), 1, '招募主看得到報名');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.brief_applications), 0, '其他品牌看不到報名');

select * from finish();
rollback;
```

- [ ] **Step 2：執行測試，確認失敗**

Run: `npm run test:db`
Expected: `02_briefs_messaging_rls` FAIL，錯誤包含 `relation "public.briefs" does not exist`。

- [ ] **Step 3：寫 migration**

`supabase/migrations/20261122000200_briefs_messaging.sql`：

```sql
-- 招募、報名、對話、訊息

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles (user_id) on delete cascade,
  title text not null,
  description text not null,
  collab_types text[] not null default '{}',
  categories text[] not null default '{}',
  min_followers integer not null default 0 check (min_followers >= 0),
  region text,
  budget_min_twd integer check (budget_min_twd >= 0),
  budget_max_twd integer check (budget_max_twd >= budget_min_twd),
  includes_product boolean not null default false,
  deadline date not null,
  cover_url text,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.brief_applications (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  message text,
  proposed_price_twd integer check (proposed_price_twd >= 0),
  status text not null default 'applied'
    check (status in ('applied', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (brief_id, creator_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles (user_id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (brand_id, creator_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  flagged_contact boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

create function public.is_conversation_participant(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
  );
$$;

alter table public.briefs enable row level security;
alter table public.brief_applications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- briefs：登入者看得到開放中的；招募主和管理員看得到全部
create policy briefs_select on public.briefs
  for select to authenticated
  using (status = 'open' or brand_id = auth.uid() or public.is_admin());
create policy briefs_write_own on public.briefs
  for all to authenticated
  using (brand_id = auth.uid())
  with check (brand_id = auth.uid() and public.my_role() = 'brand');

-- brief_applications：報名者本人、招募主、管理員看得到；只能報名開放中的招募
-- 狀態變更（錄取、婉拒、撤回）由「招募與機會頁」計畫用資料庫函式處理，這裡不開放 UPDATE
create policy brief_applications_select on public.brief_applications
  for select to authenticated
  using (
    creator_id = auth.uid()
    or exists (select 1 from public.briefs b where b.id = brief_id and b.brand_id = auth.uid())
    or public.is_admin()
  );
create policy brief_applications_insert_self on public.brief_applications
  for insert to authenticated
  with check (
    creator_id = auth.uid()
    and public.my_role() = 'creator'
    and status = 'applied'
    and exists (select 1 from public.briefs b where b.id = brief_id and b.status = 'open')
  );
revoke update, delete on public.brief_applications from anon, authenticated;

-- conversations
create policy conversations_select on public.conversations
  for select to authenticated
  using (brand_id = auth.uid() or creator_id = auth.uid() or public.is_admin());
create policy conversations_insert_participant on public.conversations
  for insert to authenticated
  with check (brand_id = auth.uid() or creator_id = auth.uid());
revoke update, delete on public.conversations from anon, authenticated;

-- messages：只有參與者能讀寫；sender_id 由預設值帶入，flagged_contact 只有伺服器能設定
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());
create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));
revoke insert, update, delete on public.messages from anon, authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;
```

- [ ] **Step 4：套用 migration 並執行測試**

Run: `npx supabase db reset && npm run test:db`
Expected: 01、02 都是 ok，`All tests successful.`

- [ ] **Step 5：Commit**

```bash
git add supabase
git commit -m "地基 Task 3：招募、報名、對話、訊息資料表與 RLS"
```

---

### Task 4：合作案、audit log、狀態轉換函式

**Files:**
- Create: `supabase/migrations/20261122000300_collaborations.sql`
- Test: `supabase/tests/03_collaborations.test.sql`

**Interfaces:**
- Consumes: Task 2、3 的資料表與函式
- Produces（SQL）：enum `public.collab_status`；資料表 `public.collaborations`、`public.audit_logs`；函式
  `public.transition_collaboration(p_collab_id uuid, p_action text, p_note text default null, p_published_url text default null) returns public.collab_status`
  - `p_action` 可用值：`accept`、`decline`、`cancel`、`mark_paid`、`submit`、`approve`、`auto_approve`、`request_changes`、`publish`、`payout`
  - 錯誤碼：不是參與者 → `42501`；不合法的轉換 → `22023`；找不到合作案 → `P0002`
  - 呼叫者的 JWT role 是 `service_role` 時，視為系統（`system`）

**狀態轉換表（函式必須完全照這張表實作）：**

| 目前狀態 | action | 誰可以 | 額外條件 | 新狀態 |
|---|---|---|---|---|
| invited | accept | creator | | awaiting_payment |
| invited | decline | creator | | declined |
| invited | cancel | brand | | cancelled |
| awaiting_payment | cancel | brand | | cancelled |
| awaiting_payment | mark_paid | system | | awaiting_submission |
| awaiting_submission | submit | creator | | in_review（設定 review_due_at = now() + 3 天） |
| in_review | approve | brand | | awaiting_publish |
| in_review | auto_approve | system | review_due_at <= now() | awaiting_publish |
| in_review | request_changes | brand | p_note 不可空白 | awaiting_submission |
| awaiting_publish | publish | creator | p_published_url 以 `https://` 開頭 | awaiting_payout（寫入 published_url） |
| awaiting_payout | payout | admin 或 system | | completed |

- [ ] **Step 1：寫測試**

`supabase/tests/03_collaborations.test.sql`：

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', 'brand', '森林寵物食堂'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000a1', 'brand', '平台管理員');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', '森林寵物食堂');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

-- ===== 品牌 b1 建立邀約 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.collaborations
      (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-00000000cc01',
            '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000a001',
            '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500)$$,
  '品牌可以建立邀約');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01' and action = 'create'),
  1, '建立邀約會寫入 audit log');
select throws_ok(
  $$update public.collaborations set status = 'completed'
    where id = '00000000-0000-0000-0000-00000000cc01'$$,
  '42501', null, '不能直接改狀態欄位');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'approve')$$,
  '22023', null, '邀約階段不能審核通過');

-- ===== 創作者 c1 接受 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'accept'),
  'awaiting_payment'::public.collab_status, '創作者接受邀約');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'mark_paid')$$,
  '22023', null, '創作者不能自己標記已付款');

-- ===== 第三方品牌 b2 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.collaborations), 0, '第三方看不到別人的合作案');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'cancel')$$,
  '42501', null, '第三方不能操作別人的合作案');

-- ===== 系統（service role）標記已付款 =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'mark_paid'),
  'awaiting_submission'::public.collab_status, '系統標記已付款');

-- ===== 創作者交稿 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'submit'),
  'in_review'::public.collab_status, '創作者交稿');
select ok(
  (select review_due_at > now() + interval '71 hours'
     from public.collaborations where id = '00000000-0000-0000-0000-00000000cc01'),
  '交稿後設定 3 天審核期限');

-- ===== 品牌要求修改 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes')$$,
  '22023', null, '要求修改必須填寫說明');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes',
                                  '第二張色調再亮一點'),
  'awaiting_submission'::public.collab_status, '品牌要求修改，退回交稿');

-- ===== 再次交稿、審核通過、發佈 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'submit'),
  'in_review'::public.collab_status, '創作者再次交稿');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'approve'),
  'awaiting_publish'::public.collab_status, '品牌審核通過');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish')$$,
  '22023', null, '發佈必須附上貼文連結');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish', null,
                                  'https://www.instagram.com/p/abc123/'),
  'awaiting_payout'::public.collab_status, '創作者發佈');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'payout')$$,
  '22023', null, '創作者不能自己撥款');

-- ===== 管理員撥款 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'payout'),
  'completed'::public.collab_status, '管理員撥款，結案');
select is(
  (select published_url from public.collaborations
     where id = '00000000-0000-0000-0000-00000000cc01'),
  'https://www.instagram.com/p/abc123/', '已記錄貼文連結');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01'),
  9, '每個成功的動作都留下一筆紀錄（create + 8 次轉換）');

-- ===== audit log 不能修改 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$delete from public.audit_logs$$,
  '42501', null, '使用者不能刪除 audit log');

reset role;
select throws_ok(
  $$update public.audit_logs set note = 'tampered'$$,
  'P0001', null, '連資料庫擁有者也不能修改 audit log');

select * from finish();
rollback;
```

- [ ] **Step 2：執行測試，確認失敗**

Run: `npm run test:db`
Expected: `03_collaborations` FAIL，錯誤包含 `relation "public.collaborations" does not exist`。

- [ ] **Step 3：寫 migration**

`supabase/migrations/20261122000300_collaborations.sql`：

```sql
-- 合作案、audit log、狀態轉換

create type public.collab_status as enum (
  'invited', 'awaiting_payment', 'awaiting_submission', 'in_review',
  'awaiting_publish', 'awaiting_payout', 'completed', 'declined', 'cancelled'
);

create table public.collaborations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles (user_id),
  creator_id uuid not null references public.creator_profiles (user_id),
  brief_id uuid references public.briefs (id),
  conversation_id uuid not null references public.conversations (id),
  title text not null,
  deliverables text not null,
  amount_twd integer not null check (amount_twd > 0),
  status public.collab_status not null default 'invited',
  review_due_at timestamptz,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collaborations_brand_idx on public.collaborations (brand_id, status);
create index collaborations_creator_idx on public.collaborations (creator_id, status);
create index collaborations_review_due_idx on public.collaborations (review_due_at)
  where status = 'in_review';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  collaboration_id uuid references public.collaborations (id),
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('brand', 'creator', 'admin', 'system')),
  action text not null,
  from_status public.collab_status,
  to_status public.collab_status,
  note text,
  created_at timestamptz not null default now()
);
create index audit_logs_collaboration_idx on public.audit_logs (collaboration_id, created_at);

-- audit log 只能新增：撤銷所有角色的寫入權限，再用 trigger 擋下擁有者
revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated, service_role;

create function public.audit_logs_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();

-- 建立合作案時自動寫入 audit log
create function public.log_collaboration_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status)
  values (
    new.id,
    auth.uid(),
    case when auth.uid() = new.brand_id then 'brand' else 'system' end,
    'create',
    null,
    new.status
  );
  return new;
end;
$$;
create trigger collaborations_audit_insert after insert on public.collaborations
  for each row execute function public.log_collaboration_created();

-- 狀態轉換：唯一可以改變合作狀態的入口
create function public.transition_collaboration(
  p_collab_id uuid,
  p_action text,
  p_note text default null,
  p_published_url text default null
) returns public.collab_status
language plpgsql security definer set search_path = '' as $$
declare
  c public.collaborations%rowtype;
  v_uid uuid := auth.uid();
  v_actor text;
  v_to public.collab_status;
begin
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found then
    raise exception 'collaboration % not found', p_collab_id using errcode = 'P0002';
  end if;

  if coalesce(auth.role(), '') = 'service_role' then
    v_actor := 'system';
  elsif public.is_admin() then
    v_actor := 'admin';
  elsif v_uid = c.brand_id then
    v_actor := 'brand';
  elsif v_uid = c.creator_id then
    v_actor := 'creator';
  else
    raise exception 'not a participant of collaboration %', p_collab_id using errcode = '42501';
  end if;

  v_to := case
    when c.status = 'invited' and p_action = 'accept' and v_actor = 'creator'
      then 'awaiting_payment'::public.collab_status
    when c.status = 'invited' and p_action = 'decline' and v_actor = 'creator'
      then 'declined'::public.collab_status
    when c.status in ('invited', 'awaiting_payment') and p_action = 'cancel' and v_actor = 'brand'
      then 'cancelled'::public.collab_status
    when c.status = 'awaiting_payment' and p_action = 'mark_paid' and v_actor = 'system'
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_submission' and p_action = 'submit' and v_actor = 'creator'
      then 'in_review'::public.collab_status
    when c.status = 'in_review' and p_action = 'approve' and v_actor = 'brand'
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'auto_approve' and v_actor = 'system'
         and c.review_due_at <= now()
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'request_changes' and v_actor = 'brand'
         and nullif(trim(p_note), '') is not null
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_publish' and p_action = 'publish' and v_actor = 'creator'
         and p_published_url ~ '^https://'
      then 'awaiting_payout'::public.collab_status
    when c.status = 'awaiting_payout' and p_action = 'payout' and v_actor in ('admin', 'system')
      then 'completed'::public.collab_status
    else null
  end;

  if v_to is null then
    raise exception 'invalid transition: % from % by %', p_action, c.status, v_actor
      using errcode = '22023';
  end if;

  update public.collaborations
  set status = v_to,
      updated_at = now(),
      review_due_at = case when v_to = 'in_review' then now() + interval '3 days' else review_due_at end,
      published_url = case when v_to = 'awaiting_payout' then p_published_url else published_url end
  where id = c.id;

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values (c.id, case when v_actor = 'system' then null else v_uid end, v_actor, p_action, c.status, v_to, p_note);

  return v_to;
end;
$$;

revoke execute on function public.transition_collaboration(uuid, text, text, text) from public, anon;
grant execute on function public.transition_collaboration(uuid, text, text, text) to authenticated, service_role;

alter table public.collaborations enable row level security;
alter table public.audit_logs enable row level security;

-- collaborations：參與者與管理員可讀；只有品牌能建立邀約；任何人都不能直接 UPDATE / DELETE
create policy collaborations_select on public.collaborations
  for select to authenticated
  using (brand_id = auth.uid() or creator_id = auth.uid() or public.is_admin());
create policy collaborations_insert_brand on public.collaborations
  for insert to authenticated
  with check (
    brand_id = auth.uid()
    and public.my_role() = 'brand'
    and status = 'invited'
    -- 子查詢裡的欄位必須寫出外層表名；只寫 brand_id 會被解析成 cv.brand_id，條件永遠成立
    and exists (
      select 1 from public.conversations cv
      where cv.id = collaborations.conversation_id
        and cv.brand_id = collaborations.brand_id
        and cv.creator_id = collaborations.creator_id
    )
  );
revoke insert, update, delete on public.collaborations from anon, authenticated;
grant insert (id, brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd)
  on public.collaborations to authenticated;

-- audit_logs：合作案參與者與管理員可讀
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
      where c.id = collaboration_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
```

- [ ] **Step 4：套用 migration 並執行測試**

Run: `npx supabase db reset && npm run test:db`
Expected: 01–03 都是 ok，`All tests successful.`

- [ ] **Step 5：Commit**

```bash
git add supabase
git commit -m "地基 Task 4：合作案、audit log、狀態轉換函式"
```

---

### Task 5：付款資料表 + 冪等的付款成功紀錄函式

**Files:**
- Create: `supabase/migrations/20261122000400_payments.sql`
- Test: `supabase/tests/04_payments.test.sql`

**Interfaces:**
- Consumes: `public.collaborations`、`public.transition_collaboration`（Task 4）
- Produces（SQL）：資料表 `public.payments`；函式
  `public.record_payment_success(p_merchant_trade_no text, p_amount_twd integer, p_provider_trade_no text, p_raw jsonb) returns text`
  - 回傳 `'paid'`（第一次成功）或 `'already_paid'`（重複通知）
  - 錯誤碼：找不到交易 → `P0002`；金額不符 → `22023`；非 service role 呼叫 → `42501`（沒有執行權限）

- [ ] **Step 1：寫測試**

`supabase/tests/04_payments.test.sql`：

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values ('00000000-0000-0000-0000-00000000cc01',
        '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-00000000a001', '春季新品開箱', 'IG 貼文 1 篇', 4500,
        'awaiting_payment');
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd) values
  ('00000000-0000-0000-0000-00000000cc01', 'ecpay', 'PL0001', 4500);

-- 一般使用者
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.record_payment_success('PL0001', 4500, 'T1', '{}'::jsonb)$$,
  '42501', null, '一般使用者不能呼叫付款成功函式');
select is((select count(*)::int from public.payments), 1, '合作案參與者看得到付款紀錄');

-- 系統
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok(
  $$select public.record_payment_success('PL0001', 4000, 'T1', '{}'::jsonb)$$,
  '22023', null, '金額不符時拒絕');
select throws_ok(
  $$select public.record_payment_success('NOPE', 4500, 'T1', '{}'::jsonb)$$,
  'P0002', null, '找不到交易時拒絕');
select is(
  public.record_payment_success('PL0001', 4500, 'T1', '{"RtnCode":"1"}'::jsonb),
  'paid', '第一次通知：標記已付款');
select is(
  (select status::text from public.collaborations
     where id = '00000000-0000-0000-0000-00000000cc01'),
  'awaiting_submission', '合作案進入交稿階段');
select is(
  public.record_payment_success('PL0001', 4500, 'T1', '{"RtnCode":"1"}'::jsonb),
  'already_paid', '重複通知不會重複處理');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01' and action = 'mark_paid'),
  1, '只留下一筆 mark_paid 紀錄');
select is(
  (select status from public.payments where merchant_trade_no = 'PL0001'),
  'paid', '付款紀錄狀態為 paid');

select * from finish();
rollback;
```

- [ ] **Step 2：執行測試，確認失敗**

Run: `npm run test:db`
Expected: `04_payments` FAIL，錯誤包含 `relation "public.payments" does not exist`。

- [ ] **Step 3：寫 migration**

`supabase/migrations/20261122000400_payments.sql`：

```sql
-- 付款紀錄（款項託管）

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations (id),
  provider text not null check (provider in ('ecpay')),
  merchant_trade_no text not null unique check (merchant_trade_no ~ '^[A-Za-z0-9]{1,20}$'),
  amount_twd integer not null check (amount_twd > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_trade_no text,
  paid_at timestamptz,
  raw_notify jsonb,
  created_at timestamptz not null default now()
);
create index payments_collaboration_idx on public.payments (collaboration_id);

alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
      where c.id = collaboration_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
-- 建單由伺服器端（service role）處理，一般使用者不能寫入
revoke insert, update, delete on public.payments from anon, authenticated;

-- 金流通知驗簽通過後呼叫；同一筆交易重複通知只會處理一次
create function public.record_payment_success(
  p_merchant_trade_no text,
  p_amount_twd integer,
  p_provider_trade_no text,
  p_raw jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments%rowtype;
begin
  select * into p from public.payments where merchant_trade_no = p_merchant_trade_no for update;
  if not found then
    raise exception 'unknown merchant_trade_no %', p_merchant_trade_no using errcode = 'P0002';
  end if;
  if p.amount_twd <> p_amount_twd then
    raise exception 'amount mismatch for %: expected %, got %',
      p_merchant_trade_no, p.amount_twd, p_amount_twd using errcode = '22023';
  end if;
  if p.status = 'paid' then
    return 'already_paid';
  end if;

  update public.payments
  set status = 'paid', provider_trade_no = p_provider_trade_no, paid_at = now(), raw_notify = p_raw
  where id = p.id;

  perform public.transition_collaboration(p.collaboration_id, 'mark_paid');
  return 'paid';
end;
$$;

revoke execute on function public.record_payment_success(text, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_payment_success(text, integer, text, jsonb) to service_role;
```

- [ ] **Step 4：套用 migration 並執行測試**

Run: `npx supabase db reset && npm run test:db`
Expected: 01–04 都是 ok，`All tests successful.`

- [ ] **Step 5：Commit**

```bash
git add supabase
git commit -m "地基 Task 5：付款資料表與冪等的付款成功紀錄函式"
```

---

### Task 6：綠界 CheckMacValue 計算與驗證

**Files:**
- Create: `src/lib/payments/ecpay.ts`
- Test: `src/lib/payments/ecpay.test.ts`

**Interfaces:**
- Produces:
  - `type EcpayParams = Record<string, string>`
  - `ecpayUrlEncode(value: string): string`
  - `computeCheckMacValue(params: EcpayParams, hashKey: string, hashIV: string): string`（64 字元大寫 hex）
  - `verifyCheckMacValue(params: EcpayParams, hashKey: string, hashIV: string): boolean`

**演算法（綠界全方位金流技術文件「檢查碼機制」）：**
1. 移除 `CheckMacValue` 參數，其餘參數依參數名稱**不分大小寫**的字母順序排序
2. 串成 `key1=value1&key2=value2...`，前面加 `HashKey=...&`，後面加 `&HashIV=...`
3. 整串做 URL encode（規則同 .NET `HttpUtility.UrlEncode`：空白轉 `+`；`-_.!*()` 不編碼），再轉成全部小寫
4. SHA256，結果轉成大寫

- [ ] **Step 1：寫失敗測試**

`src/lib/payments/ecpay.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { computeCheckMacValue, ecpayUrlEncode, verifyCheckMacValue } from "./ecpay";

// 綠界技術文件「檢查碼機制」中的官方範例（測試商店 3002607）
const DOC_KEY = "pwFHCqoQZGmho4w6";
const DOC_IV = "EkRm7iFT261dpevs";
const DOC_PARAMS = {
  ChoosePayment: "ALL",
  EncryptType: "1",
  ItemName: "Apple iphone 15",
  MerchantID: "3002607",
  MerchantTradeDate: "2023/03/12 15:30:23",
  MerchantTradeNo: "ecpay20230312153023",
  PaymentType: "aio",
  ReturnURL: "https://www.ecpay.com.tw/receive.php",
  TotalAmount: "30000",
  TradeDesc: "促銷方案",
};
const DOC_EXPECTED = "6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840";

describe("ecpayUrlEncode", () => {
  it("encodes spaces as +", () => {
    expect(ecpayUrlEncode("a b")).toBe("a+b");
  });
  it("leaves -_.!*() unencoded", () => {
    expect(ecpayUrlEncode("-_.!*()")).toBe("-_.!*()");
  });
  it("encodes ~ and ' like .NET", () => {
    expect(ecpayUrlEncode("~'")).toBe("%7e%27");
  });
  it("lowercases percent-encoding of multibyte characters", () => {
    expect(ecpayUrlEncode("促")).toBe("%e4%bf%83");
  });
});

describe("computeCheckMacValue", () => {
  it("matches the official ECPay documentation example", () => {
    expect(computeCheckMacValue(DOC_PARAMS, DOC_KEY, DOC_IV)).toBe(DOC_EXPECTED);
  });

  it("ignores an existing CheckMacValue parameter", () => {
    const withMac = { ...DOC_PARAMS, CheckMacValue: "WHATEVER" };
    expect(computeCheckMacValue(withMac, DOC_KEY, DOC_IV)).toBe(DOC_EXPECTED);
  });

  it("does not depend on parameter insertion order", () => {
    const reversed = Object.fromEntries(Object.entries(DOC_PARAMS).reverse());
    expect(computeCheckMacValue(reversed, DOC_KEY, DOC_IV)).toBe(DOC_EXPECTED);
  });
});

describe("verifyCheckMacValue", () => {
  const signed = { ...DOC_PARAMS, CheckMacValue: DOC_EXPECTED };

  it("accepts a correctly signed payload", () => {
    expect(verifyCheckMacValue(signed, DOC_KEY, DOC_IV)).toBe(true);
  });

  it("accepts a lowercase CheckMacValue", () => {
    expect(
      verifyCheckMacValue({ ...signed, CheckMacValue: DOC_EXPECTED.toLowerCase() }, DOC_KEY, DOC_IV),
    ).toBe(true);
  });

  it("rejects a tampered amount", () => {
    expect(verifyCheckMacValue({ ...signed, TotalAmount: "1" }, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("rejects the wrong HashKey", () => {
    expect(verifyCheckMacValue(signed, "wrongkey", DOC_IV)).toBe(false);
  });

  it("rejects a missing CheckMacValue", () => {
    expect(verifyCheckMacValue(DOC_PARAMS, DOC_KEY, DOC_IV)).toBe(false);
  });

  it("rejects a CheckMacValue of the wrong length", () => {
    expect(verifyCheckMacValue({ ...signed, CheckMacValue: "ABC" }, DOC_KEY, DOC_IV)).toBe(false);
  });
});
```

> **注意：** `DOC_EXPECTED` 這組官方範例值是依記憶寫入的。如果只有「matches the official ECPay documentation example」這一項失敗、其他都通過，**先到綠界開發者網站的全方位金流技術文件，找「檢查碼機制」頁面核對範例參數和結果**，以文件為準修正測試資料，不要為了通過測試而修改演算法。

- [ ] **Step 2：執行測試，確認失敗**

Run: `npm test -- src/lib/payments/ecpay.test.ts`
Expected: FAIL，錯誤是找不到 `./ecpay`。

- [ ] **Step 3：實作**

`src/lib/payments/ecpay.ts`：

```ts
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
```

- [ ] **Step 4：執行測試，確認通過**

Run: `npm test -- src/lib/payments/ecpay.test.ts`
Expected: 13 passed。

- [ ] **Step 5：Commit**

```bash
git add src/lib/payments/ecpay.ts src/lib/payments/ecpay.test.ts
git commit -m "地基 Task 6：綠界 CheckMacValue 計算與驗證"
```

---

### Task 7：綠界付款通知處理與 API route

**Files:**
- Create: `src/lib/payments/ecpay-notify.ts`
- Test: `src/lib/payments/ecpay-notify.test.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/app/api/payments/ecpay/notify/route.ts`
- Modify: `package.json`（新增 `@supabase/supabase-js`、`server-only`）

**Interfaces:**
- Consumes: `computeCheckMacValue`、`verifyCheckMacValue`（Task 6）；`requireEnv`（Task 1）；SQL 函式 `record_payment_success`（Task 5）
- Produces:
  - `type RecordPaymentResult = "paid" | "already_paid"`
  - `interface EcpayNotifyDeps { hashKey: string; hashIV: string; recordPaymentSuccess(input: { merchantTradeNo: string; amountTwd: number; providerTradeNo: string; raw: Record<string, string> }): Promise<RecordPaymentResult>; logError(message: string, meta?: Record<string, unknown>): void }`
  - `handleEcpayNotify(params: Record<string, string>, deps: EcpayNotifyDeps): Promise<{ status: number; body: string }>`
  - `createAdminClient(): SupabaseClient`（`src/lib/supabase/admin.ts`，只能在伺服器端 import）
  - HTTP：`POST /api/payments/ecpay/notify`（綠界的 `ReturnURL`）

**回應規則：**

| 情況 | HTTP status | body |
|---|---|---|
| 驗簽失敗 | 400 | `0|CheckMacValue Error` |
| `RtnCode` 不是 `1`（付款失敗） | 200 | `1|OK`（回覆收到，付款維持 pending） |
| `TradeAmt` 不是正整數 | 400 | `0|Bad TradeAmt` |
| 寫入成功（含重複通知） | 200 | `1|OK` |
| 寫入失敗（金額不符、找不到交易、資料庫錯誤） | 500 | `0|Error`（綠界會重送） |

- [ ] **Step 1：寫失敗測試**

`src/lib/payments/ecpay-notify.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import { computeCheckMacValue } from "./ecpay";
import { handleEcpayNotify, type EcpayNotifyDeps } from "./ecpay-notify";

const KEY = "testHashKey12345";
const IV = "testHashIV123456";

function signed(overrides: Record<string, string> = {}): Record<string, string> {
  const params: Record<string, string> = {
    MerchantID: "3002607",
    MerchantTradeNo: "PL0001",
    RtnCode: "1",
    RtnMsg: "Succeeded",
    TradeNo: "2311221234567890",
    TradeAmt: "4500",
    PaymentDate: "2026/11/22 10:00:00",
    PaymentType: "Credit_CreditCard",
    SimulatePaid: "0",
    ...overrides,
  };
  return { ...params, CheckMacValue: computeCheckMacValue(params, KEY, IV) };
}

function makeDeps(overrides: Partial<EcpayNotifyDeps> = {}): EcpayNotifyDeps {
  return {
    hashKey: KEY,
    hashIV: IV,
    recordPaymentSuccess: vi.fn().mockResolvedValue("paid"),
    logError: vi.fn(),
    ...overrides,
  };
}

describe("handleEcpayNotify", () => {
  it("records a successful payment and replies 1|OK", async () => {
    const deps = makeDeps();
    const params = signed();
    const res = await handleEcpayNotify(params, deps);

    expect(res).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentSuccess).toHaveBeenCalledWith({
      merchantTradeNo: "PL0001",
      amountTwd: 4500,
      providerTradeNo: "2311221234567890",
      raw: params,
    });
  });

  it("replies 1|OK for a duplicate notification", async () => {
    const deps = makeDeps({ recordPaymentSuccess: vi.fn().mockResolvedValue("already_paid") });
    expect(await handleEcpayNotify(signed(), deps)).toEqual({ status: 200, body: "1|OK" });
  });

  it("rejects a bad signature without touching the database", async () => {
    const deps = makeDeps();
    const tampered = { ...signed(), TradeAmt: "1" };
    const res = await handleEcpayNotify(tampered, deps);

    expect(res).toEqual({ status: 400, body: "0|CheckMacValue Error" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
    expect(deps.logError).toHaveBeenCalled();
  });

  it("acknowledges a failed payment without recording it", async () => {
    const deps = makeDeps();
    const res = await handleEcpayNotify(signed({ RtnCode: "10100058", RtnMsg: "Failed" }), deps);

    expect(res).toEqual({ status: 200, body: "1|OK" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
  });

  it("rejects a non-integer amount", async () => {
    const deps = makeDeps();
    const res = await handleEcpayNotify(signed({ TradeAmt: "45.5" }), deps);

    expect(res).toEqual({ status: 400, body: "0|Bad TradeAmt" });
    expect(deps.recordPaymentSuccess).not.toHaveBeenCalled();
  });

  it("returns 500 so ECPay retries when recording fails", async () => {
    const deps = makeDeps({
      recordPaymentSuccess: vi.fn().mockRejectedValue(new Error("22023: amount mismatch")),
    });
    const res = await handleEcpayNotify(signed(), deps);

    expect(res).toEqual({ status: 500, body: "0|Error" });
    expect(deps.logError).toHaveBeenCalledWith(
      "ecpay notify: record failed",
      expect.objectContaining({ merchantTradeNo: "PL0001" }),
    );
  });
});
```

- [ ] **Step 2：執行測試，確認失敗**

Run: `npm test -- src/lib/payments/ecpay-notify.test.ts`
Expected: FAIL，錯誤是找不到 `./ecpay-notify`。

- [ ] **Step 3：實作處理函式**

`src/lib/payments/ecpay-notify.ts`：

```ts
import { verifyCheckMacValue } from "./ecpay";

export type RecordPaymentResult = "paid" | "already_paid";

export interface EcpayNotifyDeps {
  hashKey: string;
  hashIV: string;
  recordPaymentSuccess(input: {
    merchantTradeNo: string;
    amountTwd: number;
    providerTradeNo: string;
    raw: Record<string, string>;
  }): Promise<RecordPaymentResult>;
  logError(message: string, meta?: Record<string, unknown>): void;
}

export async function handleEcpayNotify(
  params: Record<string, string>,
  deps: EcpayNotifyDeps,
): Promise<{ status: number; body: string }> {
  const merchantTradeNo = params.MerchantTradeNo ?? "";

  if (!verifyCheckMacValue(params, deps.hashKey, deps.hashIV)) {
    deps.logError("ecpay notify: bad CheckMacValue", { merchantTradeNo });
    return { status: 400, body: "0|CheckMacValue Error" };
  }

  if (params.RtnCode !== "1") {
    return { status: 200, body: "1|OK" };
  }

  const amountTwd = Number(params.TradeAmt);
  if (!Number.isInteger(amountTwd) || amountTwd <= 0) {
    deps.logError("ecpay notify: bad TradeAmt", { merchantTradeNo, tradeAmt: params.TradeAmt });
    return { status: 400, body: "0|Bad TradeAmt" };
  }

  try {
    await deps.recordPaymentSuccess({
      merchantTradeNo,
      amountTwd,
      providerTradeNo: params.TradeNo ?? "",
      raw: params,
    });
    return { status: 200, body: "1|OK" };
  } catch (error) {
    deps.logError("ecpay notify: record failed", { merchantTradeNo, error: String(error) });
    return { status: 500, body: "0|Error" };
  }
}
```

- [ ] **Step 4：執行測試，確認通過**

Run: `npm test`
Expected: 全部通過（env 3、ecpay 13、ecpay-notify 6，共 22 passed）。

- [ ] **Step 5：安裝套件並建立 service role client**

```bash
npm i @supabase/supabase-js server-only
```

`src/lib/supabase/admin.ts`：

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/** 使用 service role 的 client，會略過 RLS。只能在伺服器端（route handler、server action）使用。 */
export function createAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 6：建立 route handler**

`src/app/api/payments/ecpay/notify/route.ts`：

```ts
import { requireEnv } from "@/lib/env";
import { handleEcpayNotify, type RecordPaymentResult } from "@/lib/payments/ecpay-notify";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  const supabase = createAdminClient();
  const result = await handleEcpayNotify(params, {
    hashKey: requireEnv("ECPAY_HASH_KEY"),
    hashIV: requireEnv("ECPAY_HASH_IV"),
    async recordPaymentSuccess({ merchantTradeNo, amountTwd, providerTradeNo, raw }) {
      const { data, error } = await supabase.rpc("record_payment_success", {
        p_merchant_trade_no: merchantTradeNo,
        p_amount_twd: amountTwd,
        p_provider_trade_no: providerTradeNo,
        p_raw: raw,
      });
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return data as RecordPaymentResult;
    },
    logError: (message, meta) => console.error(message, meta),
  });

  return new Response(result.body, {
    status: result.status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 7：端對端手動驗證（本機）**

```bash
npx supabase status   # 把 API URL、anon key、service_role key 填進 .env.local
cp .env.example .env.local   # 若尚未建立；再把上一步的值與任意測試用 ECPAY_HASH_KEY / ECPAY_HASH_IV 填入
npm run dev
```

另開一個終端機，先建立一筆待付款的測試資料：

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美');
insert into public.brand_profiles (user_id, brand_name) values ('00000000-0000-0000-0000-0000000000b1', '花粉選物');
insert into public.creator_profiles (user_id, handle, ig_username, status)
  values ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.collaborations (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
  values ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001',
          '春季新品開箱', 'IG 貼文 1 篇', 4500, 'awaiting_payment');
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd)
  values ('00000000-0000-0000-0000-00000000cc01', 'ecpay', 'PL0001', 4500);
SQL
```

用和 `.env.local` 相同的 key 產生簽章並送出模擬通知：

```bash
MAC=$(ECPAY_HASH_KEY="$(grep ^ECPAY_HASH_KEY .env.local | cut -d= -f2)" \
      ECPAY_HASH_IV="$(grep ^ECPAY_HASH_IV .env.local | cut -d= -f2)" \
      npx tsx -e '
import { computeCheckMacValue } from "./src/lib/payments/ecpay";
console.log(computeCheckMacValue(
  { MerchantID: "3002607", MerchantTradeNo: "PL0001", RtnCode: "1", TradeNo: "T1", TradeAmt: "4500" },
  process.env.ECPAY_HASH_KEY!, process.env.ECPAY_HASH_IV!));')
curl -s -X POST http://localhost:3000/api/payments/ecpay/notify \
  --data-urlencode MerchantID=3002607 --data-urlencode MerchantTradeNo=PL0001 \
  --data-urlencode RtnCode=1 --data-urlencode TradeNo=T1 --data-urlencode TradeAmt=4500 \
  --data-urlencode CheckMacValue="$MAC"
```

Expected：印出 `1|OK`。再執行一次 curl，仍然印出 `1|OK`（重複通知）。最後確認：

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select status from public.collaborations; select action, count(*) from public.audit_logs group by action;"
```

Expected：合作案狀態是 `awaiting_submission`；`mark_paid` 只有 1 筆。

（`tsx` 未安裝時，npx 會提示下載，同意即可；這只是驗證用，不加進 package.json。）

- [ ] **Step 8：Commit**

```bash
npm run lint && npm run typecheck && npm test
git add src package.json package-lock.json
git commit -m "地基 Task 7：綠界付款通知處理與 API route"
```

---

### Task 8：CI（GitHub Actions）

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: npm scripts `lint`、`typecheck`、`test`、`build`；`supabase/migrations`、`supabase/tests`

- [ ] **Step 1：建立 workflow**

`.github/workflows/ci.yml`：

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db start
      - run: supabase test db
```

- [ ] **Step 2：本機最後完整驗證一次**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npx supabase db reset && npm run test:db`
Expected: 全部成功；Vitest 22 passed；pgTAP `All tests successful.`

- [ ] **Step 3：Commit 並 push**

```bash
git add .github/workflows/ci.yml
git commit -m "地基 Task 8：GitHub Actions CI（app + 資料庫測試）"
git push
```

Expected：GitHub 上的 `ci` workflow 兩個 job（app、db）都是綠燈。可用 `gh run watch` 查看。
