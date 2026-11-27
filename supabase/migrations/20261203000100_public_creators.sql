-- 公開的創作者列表（首頁與 /creators，訪客不用登入就能瀏覽與搜尋）。
-- 只回傳已審核創作者在公開頁（/c/<handle>）本來就看得到的欄位，加上評分；不含報價（報價只給品牌）。
-- 品牌登入後用的 search_creators（20261124000400_creator_square.sql）不變。
--
-- p_keyword：名稱、handle、IG 帳號的部分比對（照字面，最多 50 字）。
-- p_category／p_region：單選；null 或空字串＝不篩選；清單以外的值不報錯，只是比對不到。
-- p_sort：newest（預設）／followers／rating；不認得的當成 newest。rating 沒有評價的排最後。
-- p_limit 夾在 1..24（TS 的 PUBLIC_CREATORS_PAGE_SIZE = 12，見 src/lib/creators/directory.ts）；p_offset 夾在 0..5000。
-- 排序最後一律以 created_at desc, user_id 決定，分頁穩定。total_count 是符合條件的總數。
create function public.list_public_creators(
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
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_kw text := nullif(left(public.clean_text(p_keyword), 50), '');
  v_cat text := nullif(public.clean_text(p_category), '');
  v_region text := nullif(public.clean_text(p_region), '');
  v_pattern text;
  v_sort text := case when p_sort in ('newest', 'followers', 'rating') then p_sort else 'newest' end;
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
             where r.subject_id = cp.user_id and r.visible_from <= now() and r.hidden_at is null) as review_count
      from public.creator_profiles cp
      join public.profiles p on p.id = cp.user_id
     where cp.status = 'approved'
       and (v_pattern is null
            or p.display_name ilike v_pattern escape '\'
            or cp.handle ilike v_pattern escape '\'
            or cp.ig_username ilike v_pattern escape '\')
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
         pg.region, pg.categories, pg.follower_count, pg.engagement_rate::numeric,
         pg.avg_rating, pg.review_count, pg.total_count
    from paged pg
   order by pg.rn;
end;
$$;
revoke execute on function public.list_public_creators(text, text, text, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_public_creators(text, text, text, text, integer, integer) to anon, authenticated;
