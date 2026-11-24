-- 創作者公開檔案頁（計畫 3）：頭像、受眾年齡、作品、報價改走函式、公開讀取函式
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. creator_profiles 新欄位與限制
alter table public.creator_profiles
  add column avatar_path text,
  add column audience_age text;

alter table public.creator_profiles
  add constraint creator_profiles_avatar_path_check check (
    avatar_path is null
    or (
      avatar_path ~ ('^' || user_id::text || '/avatar-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
      and avatar_path !~ '\.\.'
    )
  ),
  add constraint creator_profiles_audience_age_len
    check (audience_age is null or char_length(audience_age) between 1 and 10),
  add constraint creator_profiles_bio_len
    check (bio is null or char_length(bio) between 1 and 300),
  add constraint creator_profiles_style_tags_max check (cardinality(style_tags) <= 8),
  add constraint creator_profiles_collab_types_max check (cardinality(collab_types) <= 6);

-- 2. 報價：價格上限、合作形式長度；收回直接寫入（只能經由 set_creator_rates）
alter table public.creator_rates
  add constraint creator_rates_price_max check (price_twd <= 10000000),
  add constraint creator_rates_collab_type_len check (char_length(collab_type) between 1 and 20);
drop policy creator_rates_write_own on public.creator_rates;
revoke insert, update, delete on public.creator_rates from anon, authenticated;

-- 3. 作品
create table public.creator_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  image_path text not null,
  link_url text,
  position smallint not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  unique (creator_id, position),
  constraint creator_portfolio_items_image_path_check check (
    image_path ~ ('^' || creator_id::text || '/portfolio-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and image_path !~ '\.\.'
  ),
  constraint creator_portfolio_items_link_url_len
    check (link_url is null or char_length(link_url) between 1 and 300)
);
alter table public.creator_portfolio_items enable row level security;

-- 與 creator_profiles_select 相同：已審核的公開給所有人；本人與管理員看得到全部
create policy creator_portfolio_items_select on public.creator_portfolio_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.creator_profiles cp
      where cp.user_id = creator_portfolio_items.creator_id
        and (cp.status = 'approved' or cp.user_id = auth.uid() or public.is_admin())
    )
  );

-- 本機的預設權限會自動授權全部，先全部收回再明確授權
revoke all on public.creator_portfolio_items from anon, authenticated, service_role;
grant select on public.creator_portfolio_items to anon, authenticated, service_role;

-- 4. 內部共用檢查（只給 definer 函式呼叫）
-- 文字清單：每項 clean_text 後不可為空、不可含雙向控制字元、長度 1..p_max_len、不可重複、最多 p_max_count 項
create function public.check_text_list(p text[], p_field text, p_max_count integer, p_max_len integer)
returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  v text[];
begin
  select coalesce(array_agg(public.clean_text(c) order by ord), '{}')
    into v
    from unnest(coalesce(p, '{}'::text[])) with ordinality as t(c, ord);
  if cardinality(v) > p_max_count
     or exists (select 1 from unnest(v) as c
                where c is null or public.has_bidi(c) or char_length(c) not between 1 and p_max_len)
     or (select count(distinct c) from unnest(v) as c) <> cardinality(v) then
    raise exception 'invalid %', p_field using errcode = '22023';
  end if;
  return v;
end;
$$;

-- creator-media 路徑：<uid>/<kind>-<檔名>；空字串視為 null
create function public.check_media_path(p_uid uuid, p_path text, p_kind text, p_field text)
returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(public.clean_text(p_path), '');
begin
  if v is not null and (
    v !~ ('^' || p_uid::text || '/' || p_kind || '-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$') or v ~ '\.\.'
  ) then
    raise exception 'invalid %', p_field using errcode = '22023';
  end if;
  return v;
end;
$$;

-- IG 連結：https://instagram.com/... 或 https://www.instagram.com/...（前端 isInstagramUrl 用同一條規則）
create function public.check_instagram_url(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(public.clean_text(p), '');
begin
  if v is not null and (
    public.has_bidi(v)
    or char_length(v) > 300
    or v !~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._~%/?=&+-]+$'
  ) then
    raise exception 'invalid link_url' using errcode = '22023';
  end if;
  return v;
end;
$$;

revoke execute on function public.check_text_list(text[], text, integer, integer)
  from public, anon, authenticated, service_role;
revoke execute on function public.check_media_path(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.check_instagram_url(text)
  from public, anon, authenticated, service_role;

-- 5. 公開讀取：anon 讀不到 profiles.display_name，所以用 definer 函式只回傳公開欄位。
--    已審核的給所有人；未審核的只有本人讀得到；其他情況不回傳任何列。
--    user_id 用來查作品與報價（頭像的公開網址本來就含 user_id，不算新洩漏）。
create function public.get_public_creator(p_handle text)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  region text,
  categories text[],
  follower_count integer,
  engagement_rate numeric,
  audience_age text,
  style_tags text[],
  collab_types text[],
  bio text,
  status text,
  is_self boolean
)
language sql stable security definer set search_path = '' as $$
  select cp.user_id, cp.handle, p.display_name, cp.avatar_path, cp.region, cp.categories,
         cp.follower_count, cp.engagement_rate, cp.audience_age, cp.style_tags, cp.collab_types,
         cp.bio, cp.status, coalesce(cp.user_id = auth.uid(), false)
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
   where cp.handle = p_handle
     and (cp.status = 'approved' or cp.user_id = auth.uid());
$$;
revoke execute on function public.get_public_creator(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_creator(text) to anon, authenticated;

-- 6. 修改公開頁資料（不會改到 status、handle）
--    p_avatar_path 傳 null 或空字串代表移除頭像。
--    從 collab_types 移除的合作形式，對應的報價一併刪除。
create function public.update_creator_public_profile(
  p_bio text,
  p_style_tags text[],
  p_collab_types text[],
  p_engagement_rate numeric,
  p_audience_age text,
  p_avatar_path text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_bio text := nullif(public.clean_text(p_bio), '');
  v_age text := nullif(public.clean_text(p_audience_age), '');
  v_tags text[];
  v_types text[];
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_bio is not null and (public.has_bidi(v_bio) or char_length(v_bio) > 300) then
    raise exception 'invalid bio' using errcode = '22023';
  end if;
  v_tags := public.check_text_list(p_style_tags, 'style_tags', 8, 12);
  v_types := public.check_text_list(p_collab_types, 'collab_types', 6, 20);
  if p_engagement_rate is not null and p_engagement_rate not between 0 and 100 then
    raise exception 'invalid engagement_rate' using errcode = '22023';
  end if;
  if v_age is not null and (public.has_bidi(v_age) or char_length(v_age) > 10) then
    raise exception 'invalid audience_age' using errcode = '22023';
  end if;
  v_avatar := public.check_media_path(v_uid, p_avatar_path, 'avatar', 'avatar_path');

  update public.creator_profiles
     set bio = v_bio, style_tags = v_tags, collab_types = v_types,
         engagement_rate = p_engagement_rate, audience_age = v_age, avatar_path = v_avatar
   where user_id = v_uid;
  delete from public.creator_rates
   where creator_id = v_uid and not (collab_type = any (v_types));
end;
$$;
revoke execute on function public.update_creator_public_profile(text, text[], text[], numeric, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_creator_public_profile(text, text[], text[], numeric, text, text)
  to authenticated;

-- 7. 作品整批覆寫：p_items 是陣列，每項 {image_path, link_url}，最多 6 項，position 依陣列順序
create function public.set_creator_portfolio(p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_path text;
  v_link text;
  v_pos smallint := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform 1 from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 6 then
    raise exception 'invalid portfolio' using errcode = '22023';
  end if;

  delete from public.creator_portfolio_items where creator_id = v_uid;
  for v_item in select e from jsonb_array_elements(p_items) with ordinality as t(e, ord) order by ord loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid portfolio' using errcode = '22023';
    end if;
    v_path := public.check_media_path(v_uid, v_item ->> 'image_path', 'portfolio', 'image_path');
    if v_path is null then
      raise exception 'invalid image_path' using errcode = '22023';
    end if;
    v_link := public.check_instagram_url(v_item ->> 'link_url');
    insert into public.creator_portfolio_items (creator_id, image_path, link_url, position)
    values (v_uid, v_path, v_link, v_pos);
    v_pos := v_pos + 1;
  end loop;
end;
$$;
revoke execute on function public.set_creator_portfolio(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.set_creator_portfolio(jsonb) to authenticated;

-- 8. 報價整批覆寫：p_rates 是陣列，每項 {collab_type, price_twd}；
--    collab_type 必須在自己的 collab_types 裡、不可重複；price_twd 是 0..10,000,000 的整數（JSON number）
create function public.set_creator_rates(p_rates jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_types text[];
  v_seen text[] := '{}';
  v_item jsonb;
  v_type text;
  v_price numeric;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select collab_types into v_types from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if p_rates is null or jsonb_typeof(p_rates) <> 'array' or jsonb_array_length(p_rates) > 6 then
    raise exception 'invalid rates' using errcode = '22023';
  end if;

  delete from public.creator_rates where creator_id = v_uid;
  for v_item in select e from jsonb_array_elements(p_rates) with ordinality as t(e, ord) order by ord loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid rates' using errcode = '22023';
    end if;
    v_type := public.clean_text(v_item ->> 'collab_type');
    if v_type is null or not (v_type = any (v_types)) or v_type = any (v_seen) then
      raise exception 'invalid collab_type' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'price_twd') is distinct from 'number' then
      raise exception 'invalid price_twd' using errcode = '22023';
    end if;
    v_price := (v_item ->> 'price_twd')::numeric;
    if v_price <> trunc(v_price) or v_price not between 0 and 10000000 then
      raise exception 'invalid price_twd' using errcode = '22023';
    end if;
    insert into public.creator_rates (creator_id, collab_type, price_twd)
    values (v_uid, v_type, v_price::integer);
    v_seen := v_seen || v_type;
  end loop;
end;
$$;
revoke execute on function public.set_creator_rates(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.set_creator_rates(jsonb) to authenticated;
