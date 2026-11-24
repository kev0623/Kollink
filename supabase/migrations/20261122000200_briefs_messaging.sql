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
    or exists (select 1 from public.briefs b where b.id = brief_applications.brief_id and b.brand_id = auth.uid())
    or public.is_admin()
  );
create policy brief_applications_insert_self on public.brief_applications
  for insert to authenticated
  with check (
    creator_id = auth.uid()
    and public.my_role() = 'creator'
    and status = 'applied'
    and exists (select 1 from public.briefs b where b.id = brief_applications.brief_id and b.status = 'open')
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

revoke truncate, trigger, references on public.briefs, public.brief_applications, public.conversations, public.messages from anon, authenticated;
