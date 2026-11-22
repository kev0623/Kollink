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
