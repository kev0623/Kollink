-- 合作案（計畫 6）之三：列表、詳情、系統事件的讀取函式，與審核逾期自動通過。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會）。

-- 1. 輪到誰（與 src/lib/collabs/view.ts 的 turnOf 相同規則）：brand、creator、platform 或 null（已結束）
create function public.collab_turn(p_status public.collab_status) returns text
language sql immutable set search_path = '' as $$
  select case p_status
    when 'invited' then 'creator'
    when 'awaiting_payment' then 'brand'
    when 'awaiting_submission' then 'creator'
    when 'in_review' then 'brand'
    when 'awaiting_publish' then 'creator'
    when 'awaiting_payout' then 'platform'
    else null
  end;
$$;
revoke execute on function public.collab_turn(public.collab_status) from public, anon, authenticated, service_role;

-- 2. 我的合作案列表。p_tab：active（invited..awaiting_payout）、completed、cancelled（declined + cancelled）；
--    其他值一律當 active。只列自己是品牌或創作者的（管理員看全部是計畫 9 的後台）。
--    對方的名稱與頭像：品牌讀不到 pending 創作者的 profile，所以用 definer 帶出。
--    排序：輪到我的在前，其次依更新時間由新到舊。最多 200 筆。
create function public.list_my_collaborations(p_tab text default 'active')
returns table (
  id uuid,
  title text,
  amount_twd integer,
  status text,
  updated_at timestamptz,
  brief_id uuid,
  my_side text,
  counterpart_name text,
  counterpart_image_path text,
  counterpart_handle text,
  my_turn boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_statuses public.collab_status[] := case p_tab
    when 'completed' then array['completed']::public.collab_status[]
    when 'cancelled' then array['declined', 'cancelled']::public.collab_status[]
    else array['invited', 'awaiting_payment', 'awaiting_submission', 'in_review',
               'awaiting_publish', 'awaiting_payout']::public.collab_status[]
  end;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select x.id, x.title, x.amount_twd, x.status::text, x.updated_at, x.brief_id, x.side,
         x.counterpart_name, x.counterpart_image_path, x.counterpart_handle,
         coalesce(public.collab_turn(x.status) = x.side, false)
    from (
      select c.id, c.title, c.amount_twd, c.status, c.updated_at, c.brief_id,
             case when c.brand_id = v_uid then 'brand' else 'creator' end as side,
             case when c.brand_id = v_uid then cp_profile.display_name else bp.brand_name end as counterpart_name,
             case when c.brand_id = v_uid then cp.avatar_path else bp.logo_path end as counterpart_image_path,
             case when c.brand_id = v_uid then cp.handle else null end as counterpart_handle
        from public.collaborations c
        join public.brand_profiles bp on bp.user_id = c.brand_id
        join public.creator_profiles cp on cp.user_id = c.creator_id
        join public.profiles cp_profile on cp_profile.id = c.creator_id
       where (c.brand_id = v_uid or c.creator_id = v_uid)
         and c.status = any (v_statuses)
    ) x
   order by coalesce(public.collab_turn(x.status) = x.side, false) desc, x.updated_at desc, x.id
   limit 200;
end;
$$;
revoke execute on function public.list_my_collaborations(text) from public, anon, authenticated, service_role;
grant execute on function public.list_my_collaborations(text) to authenticated;

-- 3. 一個合作案的詳情：合作案欄位、我是哪一方（brand > creator > admin，與 transition_collaboration 相同）、
--    雙方的公開資料、招募名稱。不是參與者也不是管理員：0 列（頁面顯示 404）。
create function public.get_collaboration(p_id uuid)
returns table (
  id uuid,
  title text,
  deliverables text,
  amount_twd integer,
  status text,
  review_due_at timestamptz,
  published_url text,
  created_at timestamptz,
  updated_at timestamptz,
  brief_id uuid,
  brief_title text,
  my_side text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  creator_id uuid,
  creator_name text,
  creator_handle text,
  creator_avatar_path text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select c.id, c.title, c.deliverables, c.amount_twd, c.status::text, c.review_due_at, c.published_url,
         c.created_at, c.updated_at, c.brief_id, b.title,
         case when c.brand_id = v_uid then 'brand' when c.creator_id = v_uid then 'creator' else 'admin' end,
         c.brand_id, bp.brand_name, bp.logo_path,
         c.creator_id, p.display_name, cp.handle, cp.avatar_path
    from public.collaborations c
    join public.brand_profiles bp on bp.user_id = c.brand_id
    join public.creator_profiles cp on cp.user_id = c.creator_id
    join public.profiles p on p.id = c.creator_id
    left join public.briefs b on b.id = c.brief_id
   where c.id = p_id
     and (c.brand_id = v_uid or c.creator_id = v_uid or public.is_admin());
end;
$$;
revoke execute on function public.get_collaboration(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_collaboration(uuid) to authenticated;

-- 4. 系統事件（audit_logs）依時間排列，附上做事的人的顯示名稱（讀取時才 join）：
--    品牌 → 品牌名稱、創作者 → 顯示名稱、管理員 → 「平台」、系統 → 「系統」。只有參與者與管理員看得到。
create function public.list_collaboration_events(p_id uuid)
returns table (
  id bigint,
  action text,
  actor_kind text,
  actor_name text,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.collaborations c
                  where c.id = p_id and (c.brand_id = v_uid or c.creator_id = v_uid or public.is_admin())) then
    return;
  end if;
  return query
  select l.id, l.action, l.actor_kind,
         case l.actor_kind
           when 'brand' then coalesce(bp.brand_name, '品牌')
           when 'creator' then coalesce(p.display_name, '創作者')
           when 'admin' then '平台'
           else '系統'
         end,
         l.from_status::text, l.to_status::text, l.note, l.created_at
    from public.audit_logs l
    left join public.brand_profiles bp on l.actor_kind = 'brand' and bp.user_id = l.actor_id
    left join public.profiles p on l.actor_kind = 'creator' and p.id = l.actor_id
   where l.collaboration_id = p_id
   order by l.created_at, l.id;
end;
$$;
revoke execute on function public.list_collaboration_events(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_collaboration_events(uuid) to authenticated;

-- 5. 審核逾期自動通過：只給 service_role（Vercel Cron → /api/cron/auto-approve → PostgREST）。
--    transition_collaboration 要求「PostgREST 以 service_role 呼叫」才是 system；pg_cron（postgres）會被判定為不是參與者，
--    所以不用 pg_cron（followups「10. 審核逾期自動通過」）。一件失敗不影響其他件：失敗的 id 回傳給 route 記 log。
create function public.auto_approve_due()
returns table (approved integer, failed uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_ok integer := 0;
  v_failed uuid[] := '{}';
begin
  for r in
    select c.id from public.collaborations c
     where c.status = 'in_review' and c.review_due_at <= now()
     order by c.review_due_at, c.id
  loop
    begin
      perform public.transition_collaboration(r.id, 'auto_approve');
      v_ok := v_ok + 1;
    exception when others then
      raise warning 'auto_approve_due: % failed: % %', r.id, sqlstate, sqlerrm;
      v_failed := v_failed || r.id;
    end;
  end loop;
  return query select v_ok, v_failed;
end;
$$;
revoke execute on function public.auto_approve_due() from public, anon, authenticated, service_role;
grant execute on function public.auto_approve_due() to service_role;
