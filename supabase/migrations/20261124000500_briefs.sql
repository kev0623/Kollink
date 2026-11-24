-- 招募與機會頁（計畫 5）：招募欄位調整、台灣日期、可見性、寫入函式、機會列表、報名者列表、索引
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 0. 保護：cover_url 要改名成 cover_path（值的格式也不同）。目前沒有任何程式寫入招募，正式資料庫應該是 0 筆；
--    萬一已有資料就停下來，不要讓資料默默變成不合規格（要先手動搬移再推這個 migration）。
do $$
begin
  if exists (select 1 from public.briefs) then
    raise exception 'briefs has rows: migrate cover_url to cover_path by hand before applying 20261124000500_briefs.sql';
  end if;
end;
$$;

-- 1. 台灣今天的日期。p_now 只為了讓測試能驗證跨日邊界（UTC 15:59:59 / 16:00:00）；
--    所有 policy 與函式一律不帶參數呼叫（= now()），呼叫者無法影響截止日判斷。
create function public.today_tw(p_now timestamptz default now()) returns date
language sql stable set search_path = '' as $$
  select (p_now at time zone 'Asia/Taipei')::date;
$$;
revoke execute on function public.today_tw(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.today_tw(timestamptz) to authenticated, service_role;

-- 2. briefs 欄位與限制
alter table public.briefs rename column cover_url to cover_path;
alter table public.briefs
  add column published_at timestamptz,
  alter column status set default 'draft',
  -- 草稿只檢查格式、不檢查必填，所以案名、說明、截止日在草稿可以是空的
  alter column title drop not null,
  alter column description drop not null,
  alter column deadline drop not null;

-- 文字清單的每一項都是 1..p_max_len 字（CHECK 不能用子查詢，所以包成 immutable 函式）
create function public.text_items_within(p text[], p_max_len integer) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((select bool_and(char_length(c) between 1 and p_max_len) from unnest(p) as c), true);
$$;
revoke execute on function public.text_items_within(text[], integer) from public, anon, authenticated, service_role;

alter table public.briefs
  add constraint briefs_title_len check (title is null or char_length(title) between 1 and 60),
  add constraint briefs_description_len check (description is null or char_length(description) between 1 and 2000),
  add constraint briefs_collab_types_list
    check (cardinality(collab_types) <= 6 and public.text_items_within(collab_types, 20)),
  add constraint briefs_categories_list
    check (cardinality(categories) <= 5 and public.text_items_within(categories, 30)),
  add constraint briefs_region_len check (region is null or char_length(region) between 1 and 30),
  -- 預算 0 由 save_brief 轉成 null（0 等於沒填），所以存進來的預算一定是 1..10,000,000
  add constraint briefs_budget_min_range check (budget_min_twd is null or budget_min_twd between 1 and 10000000),
  add constraint briefs_budget_max_range check (budget_max_twd is null or budget_max_twd between 1 and 10000000),
  add constraint briefs_cover_path_check check (
    cover_path is null
    or (
      cover_path ~ ('^' || brand_id::text || '/cover-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
      and cover_path !~ '\.\.'
    )
  ),
  -- 草稿以外：必填齊全、至少一種合作形式、有預算或提供產品
  add constraint briefs_published_complete check (
    status = 'draft'
    or (
      title is not null and description is not null and deadline is not null
      and cardinality(collab_types) >= 1
      and (budget_min_twd is not null or budget_max_twd is not null or includes_product)
    )
  ),
  add constraint briefs_published_at_check check ((status = 'draft') = (published_at is null));

alter table public.brief_applications
  add constraint brief_applications_message_len check (message is null or char_length(message) between 1 and 500),
  add constraint brief_applications_price_max check (proposed_price_twd is null or proposed_price_twd <= 10000000);

-- 3. 索引（followups「4. 創作者廣場、5. 招募與機會頁」）
create index briefs_status_deadline_idx on public.briefs (status, deadline);
create index briefs_brand_created_idx on public.briefs (brand_id, created_at desc);
create index brief_applications_creator_created_idx on public.brief_applications (creator_id, created_at desc);
create index brief_applications_brief_status_idx on public.brief_applications (brief_id, status);

-- 4. 可見性：招募主、管理員、創作者看得到開放中且未截止的、報名過的人看得到自己報名的（任何狀態）。
--    品牌看不到其他品牌的招募。definer：讀 brief_applications 時不經過 RLS，避免兩張表的 policy 互相遞迴。
create function public.can_view_brief(p_id uuid, p_brand_id uuid, p_status text, p_deadline date)
returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_brand_id = auth.uid()
    or public.is_admin()
    or (p_status = 'open' and p_deadline >= public.today_tw() and public.my_role() = 'creator')
    or exists (select 1 from public.brief_applications a where a.brief_id = p_id and a.creator_id = auth.uid())
  );
$$;
revoke execute on function public.can_view_brief(uuid, uuid, text, date) from public, anon, authenticated, service_role;
grant execute on function public.can_view_brief(uuid, uuid, text, date) to authenticated;

drop policy briefs_select on public.briefs;
drop policy briefs_write_own on public.briefs;
create policy briefs_select on public.briefs
  for select to authenticated
  using (public.can_view_brief(id, brand_id, status, deadline));

-- 報名只能經由 apply_to_brief
drop policy brief_applications_insert_self on public.brief_applications;

-- 寫入一律經由下面的 definer 函式；anon 完全收回（20261124000100 誤給了 anon 寫入權限）
revoke all on public.briefs from anon, authenticated, service_role;
grant select on public.briefs to authenticated, service_role;
revoke all on public.brief_applications from anon, authenticated, service_role;
grant select on public.brief_applications to authenticated, service_role;

-- 5. 「符合你的條件」：四項各自的結果。is_match = 四項都成立。
--    粉絲數 ≥ 門檻；地區不限或相同；內容領域不限或有交集；合作形式有交集（創作者沒填想接的合作時不檢查）。
create type public.brief_match as (
  followers_ok boolean,
  region_ok boolean,
  category_ok boolean,
  collab_ok boolean
);

create function public.match_brief(p_brief public.briefs, p_creator public.creator_profiles)
returns public.brief_match
language sql immutable set search_path = '' as $$
  select row(
    coalesce(p_creator.follower_count >= p_brief.min_followers, false),
    coalesce(p_brief.region is null or p_brief.region = p_creator.region, false),
    coalesce(cardinality(p_brief.categories) = 0 or p_brief.categories && p_creator.categories, false),
    coalesce(cardinality(p_creator.collab_types) = 0 or p_brief.collab_types && p_creator.collab_types, false)
  )::public.brief_match;
$$;
revoke execute on function public.match_brief(public.briefs, public.creator_profiles)
  from public, anon, authenticated, service_role;

-- 6. 品牌：新增或修改招募。p_id 是 null 時新增。
--    草稿只檢查格式；p_publish = true 或原本就是發佈中的招募，檢查完整必填與截止日（今天到 90 天內）。
--    發佈中的招募不能改回草稿；已關閉或已截止的不能修改。預算 0 視為沒填（存成 null）。
create function public.save_brief(
  p_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_collab_types text[] default null,
  p_categories text[] default null,
  p_min_followers integer default null,
  p_region text default null,
  p_budget_min_twd integer default null,
  p_budget_max_twd integer default null,
  p_includes_product boolean default false,
  p_deadline date default null,
  p_cover_path text default null,
  p_publish boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.today_tw();
  v_title text := nullif(public.clean_text(p_title), '');
  v_desc text := nullif(public.clean_text(p_description), '');
  v_region text := nullif(public.clean_text(p_region), '');
  v_followers integer := coalesce(p_min_followers, 0);
  v_min integer := nullif(p_budget_min_twd, 0);
  v_max integer := nullif(p_budget_max_twd, 0);
  v_product boolean := coalesce(p_includes_product, false);
  v_types text[];
  v_cats text[];
  v_cover text;
  v_status text;
  v_old_deadline date;
  v_published timestamptz;
  v_open boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.my_role() is distinct from 'brand'
     or not exists (select 1 from public.brand_profiles bp where bp.user_id = v_uid) then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  if p_id is not null then
    select b.status, b.deadline, b.published_at into v_status, v_old_deadline, v_published
      from public.briefs b where b.id = p_id and b.brand_id = v_uid for update;
    if not found then
      raise exception 'brief not found' using errcode = 'P0002';
    end if;
    if v_status = 'closed' or (v_status = 'open' and v_old_deadline < v_today) then
      raise exception 'brief not editable' using errcode = '55000';
    end if;
  end if;

  -- 格式（草稿也檢查）
  if v_title is not null and (public.has_bidi(v_title) or char_length(v_title) > 60) then
    raise exception 'invalid title' using errcode = '22023';
  end if;
  if v_desc is not null and (public.has_bidi(v_desc) or char_length(v_desc) > 2000) then
    raise exception 'invalid description' using errcode = '22023';
  end if;
  v_types := public.check_text_list(p_collab_types, 'collab_types', 6, 20);
  v_cats := public.check_text_list(p_categories, 'categories', 5, 30);
  if v_region is not null and (public.has_bidi(v_region) or char_length(v_region) > 30) then
    raise exception 'invalid region' using errcode = '22023';
  end if;
  if v_followers < 0 then
    raise exception 'invalid min_followers' using errcode = '22023';
  end if;
  if v_min is not null and v_min not between 1 and 10000000 then
    raise exception 'invalid budget_min_twd' using errcode = '22023';
  end if;
  if v_max is not null and (v_max not between 1 and 10000000 or v_max < coalesce(v_min, 0)) then
    raise exception 'invalid budget_max_twd' using errcode = '22023';
  end if;
  v_cover := public.check_media_path(v_uid, p_cover_path, 'cover', 'cover_path');

  -- 必填（發佈、或修改發佈中的招募）
  v_open := coalesce(p_publish, false) or v_status = 'open';
  if v_open then
    if v_title is null then
      raise exception 'invalid title' using errcode = '22023';
    end if;
    if v_desc is null then
      raise exception 'invalid description' using errcode = '22023';
    end if;
    if cardinality(v_types) = 0 then
      raise exception 'invalid collab_types' using errcode = '22023';
    end if;
    if v_min is null and v_max is null and not v_product then
      raise exception 'invalid reward' using errcode = '22023';
    end if;
    if p_deadline is null or p_deadline < v_today or p_deadline > v_today + 90 then
      raise exception 'invalid deadline' using errcode = '22023';
    end if;
  end if;

  if p_id is null then
    insert into public.briefs (brand_id, title, description, collab_types, categories, min_followers, region,
                               budget_min_twd, budget_max_twd, includes_product, deadline, cover_path,
                               status, published_at)
    values (v_uid, v_title, v_desc, v_types, v_cats, v_followers, v_region,
            v_min, v_max, v_product, p_deadline, v_cover,
            case when v_open then 'open' else 'draft' end, case when v_open then now() end)
    returning id into v_id;
  else
    update public.briefs b
       set title = v_title, description = v_desc, collab_types = v_types, categories = v_cats,
           min_followers = v_followers, region = v_region, budget_min_twd = v_min, budget_max_twd = v_max,
           includes_product = v_product, deadline = p_deadline, cover_path = v_cover,
           status = case when v_open then 'open' else 'draft' end,
           published_at = case when v_open then coalesce(v_published, now()) end
     where b.id = p_id
    returning b.id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.save_brief(uuid, text, text, text[], text[], integer, text, integer, integer, boolean, date, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.save_brief(uuid, text, text, text[], text[], integer, text, integer, integer, boolean, date, text, boolean)
  to authenticated;

-- 7. 品牌：關閉（open → closed）。已截止但狀態仍是 open 的也可以關閉。
create function public.close_brief(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.briefs b set status = 'closed'
   where b.id = p_id and b.brand_id = v_uid and b.status = 'open';
  if not found then
    if exists (select 1 from public.briefs b where b.id = p_id and b.brand_id = v_uid) then
      raise exception 'brief not open' using errcode = '55000';
    end if;
    raise exception 'brief not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.close_brief(uuid) from public, anon, authenticated, service_role;
grant execute on function public.close_brief(uuid) to authenticated;

-- 8. 品牌：刪除草稿。回傳封面路徑（沒有封面是 null），讓 App 盡力刪除 Storage 物件。
create function public.delete_brief(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_cover text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.briefs b
   where b.id = p_id and b.brand_id = v_uid and b.status = 'draft'
  returning b.cover_path into v_cover;
  if not found then
    if exists (select 1 from public.briefs b where b.id = p_id and b.brand_id = v_uid) then
      raise exception 'brief not draft' using errcode = '55000';
    end if;
    raise exception 'brief not found' using errcode = 'P0002';
  end if;
  return v_cover;
end;
$$;
revoke execute on function public.delete_brief(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_brief(uuid) to authenticated;

-- 9. 創作者：報名。必須已審核；招募必須是 open 且未截止（台灣時間，截止日當天可以）；
--    同一則只能報名一次（撤回後也不能再報名）；留言最多 500 字；報價 0..10,000,000。
create function public.apply_to_brief(p_brief_id uuid, p_message text default null, p_proposed_price integer default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_creator_status text;
  v_status text;
  v_deadline date;
  v_msg text := nullif(public.clean_text(p_message), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select cp.status into v_creator_status from public.creator_profiles cp where cp.user_id = v_uid;
  if not found or public.my_role() is distinct from 'creator' then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_creator_status <> 'approved' then
    raise exception 'creator not approved' using errcode = '42501';
  end if;
  select b.status, b.deadline into v_status, v_deadline
    from public.briefs b where b.id = p_brief_id for share;
  if not found or v_status = 'draft' then
    raise exception 'brief not found' using errcode = 'P0002';
  end if;
  if v_status <> 'open' or v_deadline < public.today_tw() then
    raise exception 'brief closed' using errcode = '55000';
  end if;
  if v_msg is not null and (public.has_bidi(v_msg) or char_length(v_msg) > 500) then
    raise exception 'invalid message' using errcode = '22023';
  end if;
  if p_proposed_price is not null and p_proposed_price not between 0 and 10000000 then
    raise exception 'invalid proposed_price_twd' using errcode = '22023';
  end if;
  begin
    insert into public.brief_applications (brief_id, creator_id, message, proposed_price_twd)
    values (p_brief_id, v_uid, v_msg, p_proposed_price)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already applied' using errcode = '23505';
  end;
  return v_id;
end;
$$;
revoke execute on function public.apply_to_brief(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.apply_to_brief(uuid, text, integer) to authenticated;

-- 10. 創作者：撤回自己待回覆的報名（applied → withdrawn）
create function public.withdraw_application(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.brief_applications a set status = 'withdrawn'
   where a.id = p_id and a.creator_id = v_uid and a.status = 'applied';
  if not found then
    if exists (select 1 from public.brief_applications a where a.id = p_id and a.creator_id = v_uid) then
      raise exception 'application not pending' using errcode = '55000';
    end if;
    raise exception 'application not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.withdraw_application(uuid) from public, anon, authenticated, service_role;
grant execute on function public.withdraw_application(uuid) to authenticated;

-- 11. 招募主：錄取或婉拒待處理的報名（applied → accepted / rejected）。招募關閉或截止後也可以。
create function public.decide_application(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_accept is null then
    raise exception 'invalid accept' using errcode = '22023';
  end if;
  update public.brief_applications a
     set status = case when p_accept then 'accepted' else 'rejected' end
    from public.briefs b
   where a.id = p_id and b.id = a.brief_id and b.brand_id = v_uid and a.status = 'applied';
  if not found then
    if exists (select 1 from public.brief_applications a join public.briefs b on b.id = a.brief_id
                where a.id = p_id and b.brand_id = v_uid) then
      raise exception 'application not pending' using errcode = '55000';
    end if;
    raise exception 'application not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.decide_application(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.decide_application(uuid, boolean) to authenticated;

-- 12. 報名人數：只算 applied 與 accepted；只回傳呼叫者看得到的招募。
--     pending_count（待處理 = applied）只有招募主看得到，其他人是 null。
create function public.brief_application_counts(p_ids uuid[])
returns table (brief_id uuid, applicant_count bigint, pending_count bigint)
language sql stable security definer set search_path = '' as $$
  select b.id,
         count(a.id) filter (where a.status in ('applied', 'accepted')),
         case when b.brand_id = auth.uid() then count(a.id) filter (where a.status = 'applied') end
    from public.briefs b
    left join public.brief_applications a on a.brief_id = b.id
   where b.id = any (coalesce(p_ids, '{}'::uuid[]))
     and public.can_view_brief(b.id, b.brand_id, b.status, b.deadline)
   group by b.id, b.brand_id;
$$;
revoke execute on function public.brief_application_counts(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.brief_application_counts(uuid[]) to authenticated;

-- 13. 機會列表：只給創作者（含未審核）。只列 open 且未截止的；依截止日由近到遠。
--     p_filter：match（預設，清單以外的值也當 match）、all、category（p_category 必須在招募的內容領域裡，
--     「不限」的招募不算）、cash（有預算）、product（提供產品）。p_limit 夾在 1..40。
create function public.list_opportunities(
  p_filter text default 'match',
  p_category text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  collab_types text[],
  categories text[],
  min_followers integer,
  region text,
  budget_min_twd integer,
  budget_max_twd integer,
  includes_product boolean,
  deadline date,
  cover_path text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  applicant_count bigint,
  followers_ok boolean,
  region_ok boolean,
  category_ok boolean,
  collab_ok boolean,
  is_match boolean,
  has_applied boolean,
  my_status text,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_cp public.creator_profiles;
  v_filter text := case when p_filter in ('match', 'all', 'category', 'cash', 'product') then p_filter else 'match' end;
  v_cat text := nullif(left(public.clean_text(p_category), 30), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 40);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_today date := public.today_tw();
begin
  select * into v_cp from public.creator_profiles cp where cp.user_id = v_uid;
  if v_uid is null or not found or public.my_role() is distinct from 'creator' then
    raise exception 'not a creator' using errcode = '42501';
  end if;

  return query
  with base as (
    select b.id, b.title, b.collab_types, b.categories, b.min_followers, b.region, b.budget_min_twd,
           b.budget_max_twd, b.includes_product, b.deadline, b.cover_path, b.brand_id, b.created_at,
           bp.brand_name, bp.logo_path as brand_logo_path,
           m.followers_ok, m.region_ok, m.category_ok, m.collab_ok,
           (m.followers_ok and m.region_ok and m.category_ok and m.collab_ok) as is_match,
           my.status as my_status
      from public.briefs b
      join public.brand_profiles bp on bp.user_id = b.brand_id
      cross join lateral public.match_brief(b, v_cp) as m
      left join public.brief_applications my on my.brief_id = b.id and my.creator_id = v_uid
     where b.status = 'open' and b.deadline >= v_today
  ),
  filtered as (
    select x.* from base x
     where case v_filter
             when 'match' then x.is_match
             when 'category' then v_cat is not null and x.categories @> array[v_cat]
             when 'cash' then coalesce(x.budget_min_twd, 0) > 0 or coalesce(x.budget_max_twd, 0) > 0
             when 'product' then x.includes_product
             else true
           end
  ),
  paged as (
    select f.*, count(*) over () as total_count
      from filtered f
     order by f.deadline, f.created_at desc, f.id
     limit v_limit offset v_offset
  )
  select p.id, p.title, p.collab_types, p.categories, p.min_followers, p.region, p.budget_min_twd,
         p.budget_max_twd, p.includes_product, p.deadline, p.cover_path, p.brand_id, p.brand_name,
         p.brand_logo_path,
         (select count(*) from public.brief_applications a
           where a.brief_id = p.id and a.status in ('applied', 'accepted')),
         p.followers_ok, p.region_ok, p.category_ok, p.collab_ok, p.is_match,
         p.my_status is not null, p.my_status, p.total_count
    from paged p
   order by p.deadline, p.created_at desc, p.id;
end;
$$;
revoke execute on function public.list_opportunities(text, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_opportunities(text, text, integer, integer) to authenticated;

-- 14. 機會詳情：只給創作者。看得到的條件與 briefs_select 相同（開放中且未截止、或自己報名過）；
--     草稿與看不到的招募不回傳任何列（頁面顯示 404）。另外帶出自己的報名。
create function public.get_opportunity(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  status text,
  collab_types text[],
  categories text[],
  min_followers integer,
  region text,
  budget_min_twd integer,
  budget_max_twd integer,
  includes_product boolean,
  deadline date,
  cover_path text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  applicant_count bigint,
  followers_ok boolean,
  region_ok boolean,
  category_ok boolean,
  collab_ok boolean,
  is_match boolean,
  my_application_id uuid,
  my_status text,
  my_message text,
  my_proposed_price_twd integer
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_cp public.creator_profiles;
begin
  select * into v_cp from public.creator_profiles cp where cp.user_id = v_uid;
  if v_uid is null or not found or public.my_role() is distinct from 'creator' then
    raise exception 'not a creator' using errcode = '42501';
  end if;

  return query
  select b.id, b.title, b.description, b.status, b.collab_types, b.categories, b.min_followers, b.region,
         b.budget_min_twd, b.budget_max_twd, b.includes_product, b.deadline, b.cover_path, b.brand_id,
         bp.brand_name, bp.logo_path,
         (select count(*) from public.brief_applications a
           where a.brief_id = b.id and a.status in ('applied', 'accepted')),
         m.followers_ok, m.region_ok, m.category_ok, m.collab_ok,
         (m.followers_ok and m.region_ok and m.category_ok and m.collab_ok),
         my.id, my.status, my.message, my.proposed_price_twd
    from public.briefs b
    join public.brand_profiles bp on bp.user_id = b.brand_id
    cross join lateral public.match_brief(b, v_cp) as m
    left join public.brief_applications my on my.brief_id = b.id and my.creator_id = v_uid
   where b.id = p_id
     and b.status <> 'draft'
     and ((b.status = 'open' and b.deadline >= public.today_tw()) or my.id is not null);
end;
$$;
revoke execute on function public.get_opportunity(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_opportunity(uuid) to authenticated;

-- 15. 報名者列表：只給招募主。創作者的公開資料（名稱、頭像、粉絲、互動率）品牌不一定讀得到
--     （未審核或停權的不公開），所以用 definer 函式照實帶出；報名本來就只有已審核的創作者。
create function public.list_brief_applicants(p_brief_id uuid)
returns table (
  id uuid,
  creator_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  follower_count integer,
  engagement_rate numeric,
  region text,
  message text,
  proposed_price_twd integer,
  status text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null
     or not exists (select 1 from public.briefs b where b.id = p_brief_id and b.brand_id = auth.uid()) then
    raise exception 'not brief owner' using errcode = '42501';
  end if;
  return query
  select a.id, a.creator_id, cp.handle, p.display_name, cp.avatar_path, cp.follower_count,
         cp.engagement_rate::numeric, cp.region, a.message, a.proposed_price_twd, a.status, a.created_at
    from public.brief_applications a
    join public.creator_profiles cp on cp.user_id = a.creator_id
    join public.profiles p on p.id = a.creator_id
   where a.brief_id = p_brief_id
   order by a.created_at desc, a.id;
end;
$$;
revoke execute on function public.list_brief_applicants(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_brief_applicants(uuid) to authenticated;
