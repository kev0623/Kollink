-- 品牌端創作者廣場（計畫 4）：收藏、搜尋函式、熱門風格標籤、索引
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. 收藏：品牌只能讀、新增、刪除自己的收藏；不開放 UPDATE。
--    收藏未審核的創作者資料庫允許（審核狀態會變），廣場只列出已審核的人。
create table public.creator_favorites (
  brand_id uuid not null references public.brand_profiles (user_id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);
alter table public.creator_favorites enable row level security;

create policy creator_favorites_select_own on public.creator_favorites
  for select to authenticated using (brand_id = auth.uid());
create policy creator_favorites_insert_own on public.creator_favorites
  for insert to authenticated with check (brand_id = auth.uid() and public.my_role() = 'brand');
create policy creator_favorites_delete_own on public.creator_favorites
  for delete to authenticated using (brand_id = auth.uid());

-- 本機的預設權限會自動授權全部，先全部收回再明確授權（created_at 由預設值決定，不接受寫入）
revoke all on public.creator_favorites from anon, authenticated, service_role;
grant select, delete on public.creator_favorites to authenticated;
grant insert (brand_id, creator_id) on public.creator_favorites to authenticated;
grant select on public.creator_favorites to service_role;

-- 2. 索引（followups「4. 創作者廣場」）
create index creator_profiles_status_created_idx on public.creator_profiles (status, created_at desc);
create index creator_profiles_categories_gin on public.creator_profiles using gin (categories);
create index creator_profiles_style_tags_gin on public.creator_profiles using gin (style_tags);
create index creator_profiles_collab_types_gin on public.creator_profiles using gin (collab_types);
create index creator_rates_creator_price_idx on public.creator_rates (creator_id, price_twd);
create index creator_favorites_brand_created_idx on public.creator_favorites (brand_id, created_at desc);

-- 3. 搜尋：只給品牌；只回傳已審核的創作者。結果含報價，所以不能給品牌以外的人（報價只給品牌看）。
--    多選欄位內是 OR（&&、= any），不同欄位之間是 AND；空陣列或 null 代表不篩選。
--    清單以外的值不報錯，只是比對不到（followups：搜尋必須能容忍清單以外的值）。
--    區間是「下限含、上限不含」：p_follower_min <= 粉絲 < p_follower_max；p_price_min <= 起價 < p_price_max。
--    起價 = 該創作者所有報價的最低價；有起價區間時，沒有報價的人不列出。
--    p_sort 不認得時當成 newest；p_limit 夾在 1..48；排序最後一律以 created_at desc, user_id 決定，分頁穩定。
--    total_count 是符合條件的總數（window 函式，與資料同一次查詢）。
create function public.search_creators(
  p_keyword text default null,
  p_favorites_only boolean default false,
  p_categories text[] default null,
  p_style_tags text[] default null,
  p_follower_min integer default null,
  p_follower_max integer default null,
  p_engagement_min numeric default null,
  p_price_min integer default null,
  p_price_max integer default null,
  p_regions text[] default null,
  p_collab_types text[] default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  region text,
  categories text[],
  style_tags text[],
  collab_types text[],
  follower_count integer,
  engagement_rate numeric,
  min_price integer,
  post_price integer,
  portfolio_paths text[],
  is_favorite boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_kw text := nullif(left(public.clean_text(p_keyword), 100), '');
  v_pattern text;
  v_sort text := case when p_sort in ('newest', 'followers', 'engagement', 'price') then p_sort else 'newest' end;
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null or public.my_role() is distinct from 'brand' then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  -- 關鍵字照字面比對：先跳脫 \，再跳脫 % 與 _
  if v_kw is not null then
    v_pattern := '%' || replace(replace(replace(v_kw, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select cp.user_id, cp.handle, p.display_name, cp.avatar_path, cp.region, cp.categories,
           cp.style_tags, cp.collab_types, cp.follower_count, cp.engagement_rate, cp.created_at,
           (select min(r.price_twd) from public.creator_rates r where r.creator_id = cp.user_id) as min_price,
           (select r.price_twd from public.creator_rates r
             where r.creator_id = cp.user_id and r.collab_type = 'IG 貼文') as post_price,
           exists (select 1 from public.creator_favorites f
                    where f.brand_id = v_uid and f.creator_id = cp.user_id) as is_favorite
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
     where cp.status = 'approved'
       and (v_pattern is null
            or p.display_name ilike v_pattern escape '\'
            or cp.handle ilike v_pattern escape '\'
            or cp.ig_username ilike v_pattern escape '\')
       and (coalesce(cardinality(p_categories), 0) = 0 or cp.categories && p_categories)
       and (coalesce(cardinality(p_style_tags), 0) = 0 or cp.style_tags && p_style_tags)
       and (coalesce(cardinality(p_collab_types), 0) = 0 or cp.collab_types && p_collab_types)
       and (coalesce(cardinality(p_regions), 0) = 0 or cp.region = any (p_regions))
       and (p_follower_min is null or cp.follower_count >= p_follower_min)
       and (p_follower_max is null or cp.follower_count < p_follower_max)
       and (p_engagement_min is null or cp.engagement_rate >= p_engagement_min)
  ),
  filtered as (
    select b.* from base b
     where (not coalesce(p_favorites_only, false) or b.is_favorite)
       and (p_price_min is null or b.min_price >= p_price_min)
       and (p_price_max is null or b.min_price < p_price_max)
  ),
  paged as (
    select f.*,
           count(*) over () as total_count,
           row_number() over (
             order by
               case when v_sort = 'followers' then f.follower_count end desc nulls last,
               case when v_sort = 'engagement' then f.engagement_rate end desc nulls last,
               case when v_sort = 'price' then f.min_price end asc nulls last,
               f.created_at desc,
               f.user_id
           ) as rn
      from filtered f
     order by rn
     limit v_limit offset v_offset
  )
  select pg.user_id, pg.handle, pg.display_name, pg.avatar_path, pg.region, pg.categories,
         pg.style_tags, pg.collab_types, pg.follower_count, pg.engagement_rate::numeric,
         pg.min_price, pg.post_price,
         array(select pi.image_path from public.creator_portfolio_items pi
                where pi.creator_id = pg.user_id order by pi.position limit 3),
         pg.is_favorite, pg.created_at, pg.total_count
    from paged pg
   order by pg.rn;
end;
$$;
revoke execute on function public.search_creators(
  text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.search_creators(
  text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer
) to authenticated;

-- 4. 熱門風格標籤：已審核創作者用過的風格標籤與使用次數，最多 20 個（次數多的在前，同次數依標籤排序）
create function public.popular_style_tags()
returns table (tag text, uses bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null or public.my_role() is distinct from 'brand' then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  return query
  select t.tag, count(*) as uses
    from public.creator_profiles cp
    cross join lateral unnest(cp.style_tags) as t(tag)
   where cp.status = 'approved'
   group by t.tag
   order by count(*) desc, t.tag
   limit 20;
end;
$$;
revoke execute on function public.popular_style_tags() from public, anon, authenticated, service_role;
grant execute on function public.popular_style_tags() to authenticated;
