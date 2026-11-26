-- 報名者列表分頁。原本的 list_brief_applicants(uuid) 一次回傳全部報名者，報名多的招募會很慢；
-- 新增分頁版與各狀態人數。舊函式保留（已部署的舊版網站還在呼叫），之後確認沒有呼叫端再移除。

-- 1. 分頁版：只有招募主能呼叫。p_status：applied／accepted／rejected；其他任何值（含 null、'all'）= 全部（含已撤回）。
--    p_limit 夾在 1..50（TS 的 PAGE_SIZE = 20，見 src/lib/paging.ts）；p_offset 夾在 0..100000。
--    排序與舊函式相同：新的在前，同一時間依 id（順序穩定，換頁不會重複或漏掉）。
create function public.list_brief_applicants_page(
  p_brief_id uuid,
  p_status text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
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
  created_at timestamptz,
  collaboration_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_status text := case when p_status in ('applied', 'accepted', 'rejected') then p_status end;
begin
  if auth.uid() is null
     or not exists (select 1 from public.briefs b where b.id = p_brief_id and b.brand_id = auth.uid()) then
    raise exception 'not brief owner' using errcode = '42501';
  end if;
  return query
  select a.id, a.creator_id, cp.handle, p.display_name, cp.avatar_path, cp.follower_count,
         cp.engagement_rate::numeric, cp.region, a.message, a.proposed_price_twd, a.status, a.created_at,
         c.id
    from public.brief_applications a
    join public.creator_profiles cp on cp.user_id = a.creator_id
    join public.profiles p on p.id = a.creator_id
    left join public.collaborations c on c.brief_id = a.brief_id and c.creator_id = a.creator_id
   where a.brief_id = p_brief_id
     and (v_status is null or a.status = v_status)
   order by a.created_at desc, a.id
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 100000);
end;
$$;
revoke execute on function public.list_brief_applicants_page(uuid, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_brief_applicants_page(uuid, text, integer, integer) to authenticated;

-- 2. 各狀態人數（篩選標籤上的數字與總頁數）：只有招募主能呼叫，永遠回傳一列。
--    條件與分頁版相同（同樣的 join），數字才會和列表對得上。
create function public.brief_applicant_status_counts(p_brief_id uuid)
returns table (all_count bigint, applied_count bigint, accepted_count bigint, rejected_count bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null
     or not exists (select 1 from public.briefs b where b.id = p_brief_id and b.brand_id = auth.uid()) then
    raise exception 'not brief owner' using errcode = '42501';
  end if;
  return query
  select count(*),
         count(*) filter (where a.status = 'applied'),
         count(*) filter (where a.status = 'accepted'),
         count(*) filter (where a.status = 'rejected')
    from public.brief_applications a
    join public.creator_profiles cp on cp.user_id = a.creator_id
    join public.profiles p on p.id = a.creator_id
   where a.brief_id = p_brief_id;
end;
$$;
revoke execute on function public.brief_applicant_status_counts(uuid) from public, anon, authenticated, service_role;
grant execute on function public.brief_applicant_status_counts(uuid) to authenticated;
