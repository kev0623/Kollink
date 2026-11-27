-- 公開頁的顯示規則變更（2026-11-27）：
--   訪客（沒登入）看得到：作品、自介、類別、評價、**完整報價**。
--   登入後才看得到：**粉絲數**、**IG 帳號與作品的貼文連結**。
-- 目的：公開頁能被搜尋引擎收錄，同時把「看粉絲數、連到本人帳號」留給註冊的人。
-- 規則在資料庫執行（不只是畫面不顯示）：訪客直接打 API 也拿不到。

-- 1. 訪客不能再直接讀這三個欄位（原本是欄位授權，見 20261124000100_explicit_api_grants.sql 之後的各檔）。
revoke select (follower_count, ig_username) on public.creator_profiles from anon;
-- creator_portfolio_items 對 anon 原本是整張表的授權，單撤一個欄位不會生效：先整個撤掉，再把公開頁需要的欄位授權回去。
revoke select on public.creator_portfolio_items from anon;
grant select (id, creator_id, image_path, position, created_at) on public.creator_portfolio_items to anon;

-- 2. 公開頁：訪客拿到的 follower_count 是 null。其餘與 20261124000200_creator_public_profile.sql 完全相同。
create or replace function public.get_public_creator(p_handle text)
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
         case when auth.uid() is not null then cp.follower_count end, cp.engagement_rate, cp.audience_age, cp.style_tags, cp.collab_types,
         cp.bio, cp.status, coalesce(cp.user_id = auth.uid(), false)
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
   where cp.handle = p_handle
     and (cp.status = 'approved' or cp.user_id = auth.uid());
$$;

-- 3. 公開列表：訪客拿到的 follower_count 是 null、不能依粉絲數排序、不能用 IG 帳號搜尋。
--    其餘與 20261203000200_public_creator_min_price.sql 完全相同（簽章與回傳欄位不變，授權沿用）。
create or replace function public.list_public_creators(
  p_keyword text default null,
  p_category text default null,
  p_region text default null,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  handle text,
  display_name text,
  avatar_path text,
  cover_path text,
  region text,
  categories text[],
  follower_count integer,
  engagement_rate numeric,
  avg_rating numeric,
  review_count integer,
  min_price integer,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_kw text := nullif(left(public.clean_text(p_keyword), 50), '');
  v_cat text := nullif(public.clean_text(p_category), '');
  v_region text := nullif(public.clean_text(p_region), '');
  v_pattern text;
  -- 粉絲數登入後才看得到：訪客不能用粉絲數排序（會從順序推回數字）
  v_in boolean := auth.uid() is not null;
  v_sort text := case when p_sort in ('newest', 'rating', 'price') or (p_sort = 'followers' and auth.uid() is not null)
                      then p_sort else 'newest' end;
begin
  -- 關鍵字照字面比對：先跳脫 \，再跳脫 % 與 _
  if v_kw is not null then
    v_pattern := '%' || replace(replace(replace(v_kw, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select cp.user_id, cp.handle, p.display_name, cp.avatar_path, cp.region, cp.categories,
           cp.follower_count, cp.engagement_rate, cp.created_at,
           (select round(avg(r.rating), 1) from public.collaboration_reviews r
             where r.subject_id = cp.user_id and r.visible_from <= now() and r.hidden_at is null) as avg_rating,
           (select count(*)::integer from public.collaboration_reviews r
             where r.subject_id = cp.user_id and r.visible_from <= now() and r.hidden_at is null) as review_count,
           (select min(cr.price_twd) from public.creator_rates cr where cr.creator_id = cp.user_id) as min_price
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
     where cp.status = 'approved'
       and (v_pattern is null
            or p.display_name ilike v_pattern escape '\'
            or cp.handle ilike v_pattern escape '\'
            -- IG 帳號登入後才看得到：訪客不能用它搜尋
            or (v_in and cp.ig_username ilike v_pattern escape '\'))
       and (v_cat is null or v_cat = any (cp.categories))
       and (v_region is null or cp.region = v_region)
  ),
  paged as (
    select b.*,
           count(*) over () as total_count,
           row_number() over (
             order by
               case when v_sort = 'followers' then b.follower_count end desc nulls last,
               case when v_sort = 'rating' then b.avg_rating end desc nulls last,
               case when v_sort = 'rating' then b.review_count end desc nulls last,
               case when v_sort = 'price' then b.min_price end asc nulls last,
               b.created_at desc,
               b.user_id
           ) as rn
      from base b
     order by rn
     limit least(greatest(coalesce(p_limit, 12), 1), 24)
    offset least(greatest(coalesce(p_offset, 0), 0), 5000)
  )
  select pg.handle, pg.display_name, pg.avatar_path,
         (select pi.image_path from public.creator_portfolio_items pi
           where pi.creator_id = pg.user_id order by pi.position limit 1),
         pg.region, pg.categories, case when v_in then pg.follower_count end, pg.engagement_rate::numeric,
         pg.avg_rating, pg.review_count, pg.min_price, pg.total_count
    from paged pg
   order by pg.rn;
end;
$$;
revoke execute on function public.list_public_creators(text, text, text, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_public_creators(text, text, text, text, integer, integer) to anon, authenticated;

-- 4. 完整報價公開：已審核創作者的各項報價給所有人（含訪客）；未審核的只有本人。
--    creator_rates 資料表的授權與 RLS 不變（訪客仍然不能直接讀表），統一經由這個函式。
--    排序交給 App（依創作者設定的合作形式順序，src/lib/creators/view.ts 的 sortRatesByTypes）。
create function public.list_creator_rates(p_creator_id uuid)
returns table (collab_type text, price_twd integer)
language sql stable security definer set search_path = '' as $$
  select r.collab_type, r.price_twd
    from public.creator_rates r
    join public.creator_profiles cp on cp.user_id = r.creator_id
   where r.creator_id = p_creator_id
     and (cp.status = 'approved' or cp.user_id = auth.uid());
$$;
revoke execute on function public.list_creator_rates(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_creator_rates(uuid) to anon, authenticated;
