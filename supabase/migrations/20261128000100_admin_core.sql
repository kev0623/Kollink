-- 計畫 9：管理後台（一）權限收斂、創作者審核、違規訊息
-- 規則見 docs/superpowers/specs/2026-11-27-admin-design.md。

-- 1. is_admin()／my_role() 收回 PUBLIC 與 anon 的 EXECUTE（followups §9）
--    authenticated 的 policy（RLS、storage、Realtime）會呼叫它們，所以再 grant 給 authenticated。
--    anon 會套用的 policy 只有 creator_profiles、creator_portfolio_items 兩條：拆成 anon 專用（不呼叫函式）與 authenticated。
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.my_role() to authenticated, service_role;

drop policy creator_profiles_select on public.creator_profiles;
create policy creator_profiles_select_anon on public.creator_profiles
  for select to anon
  using (status = 'approved');
create policy creator_profiles_select on public.creator_profiles
  for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());

drop policy creator_portfolio_items_select on public.creator_portfolio_items;
create policy creator_portfolio_items_select_anon on public.creator_portfolio_items
  for select to anon
  using (exists (
    select 1 from public.creator_profiles cp
     where cp.user_id = creator_portfolio_items.creator_id and cp.status = 'approved'));
create policy creator_portfolio_items_select on public.creator_portfolio_items
  for select to authenticated
  using (exists (
    select 1 from public.creator_profiles cp
     where cp.user_id = creator_portfolio_items.creator_id
       and (cp.status = 'approved' or cp.user_id = auth.uid() or public.is_admin())));

-- 2. 管理員身分（內部 helper，不授權給 API 角色）
--    管理員（is_admin）回傳 'admin'；以 service_role 執行的 README 備用 SQL 回傳 'system'；其他一律 42501 not admin。
create function public.admin_actor() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     and coalesce(current_setting('role', true), '') = 'service_role' then
    return 'system';
  end if;
  if auth.uid() is not null and public.is_admin() then
    return 'admin';
  end if;
  raise exception 'not admin' using errcode = '42501';
end;
$$;
revoke execute on function public.admin_actor() from public, anon, authenticated, service_role;

-- 管理員備註／原因：clean_text 後 1–500 字、不能有雙向控制字元（src/lib/admin/notes.ts 的 ADMIN_NOTE_MAX 相同）
create function public.admin_clean_note(p text, p_field text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(public.clean_text(p), '');
begin
  if v is null or char_length(v) > 500 or public.has_bidi(v) then
    raise exception 'invalid %', p_field using errcode = '22023';
  end if;
  return v;
end;
$$;
revoke execute on function public.admin_clean_note(text, text) from public, anon, authenticated, service_role;

-- 3. audit_logs：管理員對「人」的動作（審核、看收款帳戶、檢視訊息）沒有合作案，記在 subject_id。
--    collaboration_id 為 null 的列只有管理員讀得到（audit_logs_select 的 exists 不成立）。
alter table public.audit_logs add column subject_id uuid;
create index audit_logs_subject_idx on public.audit_logs (subject_id, created_at) where subject_id is not null;

-- 4. 創作者審核：新增 rejected（退回，可修改後重新送審）與 review_note（退回／停權原因，給創作者本人看）
--    approved／pending 一律沒有 review_note，所以公開可讀的已審核列不會帶出原因。
alter table public.creator_profiles drop constraint creator_profiles_status_check;
alter table public.creator_profiles
  add constraint creator_profiles_status_check
    check (status in ('pending', 'approved', 'suspended', 'rejected')),
  add column review_note text,
  add constraint creator_profiles_review_note
    check (review_note is null
           or (status in ('rejected', 'suspended') and char_length(review_note) between 1 and 500));

-- handle 鎖定：原本「第一次離開 pending 就鎖定」，退回（rejected）不鎖，只有 approved／suspended 才鎖。
-- 其餘與 20261123000100_accounts.sql 相同。
create or replace function public.creator_profiles_lock_handle() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_admin boolean := coalesce(current_setting('kollink.allow_handle_change', true), '') = 'on'
    and current_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    -- 傳入的 handle_locked_at 一律忽略，由 status 決定
    new.handle_locked_at := case when new.status in ('approved', 'suspended') then now() else null end;
    return new;
  end if;

  if not v_admin then
    if new.user_id is distinct from old.user_id then
      raise exception 'handle locked after approval' using errcode = '42501';
    end if;
    if old.handle_locked_at is not null then
      if new.handle is distinct from old.handle
         or new.handle_locked_at is distinct from old.handle_locked_at then
        raise exception 'handle locked after approval' using errcode = '42501';
      end if;
      return new;
    end if;
    -- 未鎖定時不能自行設定 handle_locked_at
    if new.handle_locked_at is not null then
      raise exception 'handle locked after approval' using errcode = '42501';
    end if;
  elsif old.handle_locked_at is not null then
    return new;
  end if;

  -- 第一次審核通過（或停權）就鎖定
  if new.status in ('approved', 'suspended') and new.handle_locked_at is null then
    new.handle_locked_at := now();
  end if;
  return new;
end;
$$;

-- 管理員改創作者狀態（followups §3、§9 的 set_creator_status）
--   approve：pending／rejected → approved
--   reject：pending → rejected（原因必填，創作者看得到）
--   suspend：approved → suspended（原因必填，創作者看得到；對話自動暫停，計畫 7）
--   unsuspend：suspended → approved
-- 寫 audit（action = creator_<動作>、subject_id = 創作者、note = 原因）。回傳新狀態。
create function public.set_creator_status(p_user_id uuid, p_action text, p_reason text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_reason text;
  v_old text;
  v_new text;
begin
  if p_action is null or p_action not in ('approve', 'reject', 'suspend', 'unsuspend') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if p_action in ('reject', 'suspend') then
    v_reason := public.admin_clean_note(p_reason, 'reason');
  elsif nullif(public.clean_text(p_reason), '') is not null then
    v_reason := public.admin_clean_note(p_reason, 'reason');
  end if;

  select cp.status into v_old from public.creator_profiles cp where cp.user_id = p_user_id for update;
  if not found then
    raise exception 'creator not found' using errcode = 'P0002';
  end if;
  v_new := case
    when p_action = 'approve' and v_old in ('pending', 'rejected') then 'approved'
    when p_action = 'reject' and v_old = 'pending' then 'rejected'
    when p_action = 'suspend' and v_old = 'approved' then 'suspended'
    when p_action = 'unsuspend' and v_old = 'suspended' then 'approved'
  end;
  if v_new is null then
    raise exception 'creator status changed' using errcode = '55000';
  end if;

  update public.creator_profiles
     set status = v_new,
         review_note = case when v_new in ('rejected', 'suspended') then v_reason end
   where user_id = p_user_id;

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, case when v_actor = 'admin' then auth.uid() end, v_actor, 'creator_' || p_action, p_user_id, v_reason);
  return v_new;
end;
$$;
revoke execute on function public.set_creator_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_creator_status(uuid, text, text) to authenticated, service_role;

-- 創作者被退回後，修正完自己按「重新送審」：rejected → pending，清掉原因（驗證碼不變）。
create function public.request_creator_review() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select cp.status into v_old from public.creator_profiles cp where cp.user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_old <> 'rejected' then
    raise exception 'creator status changed' using errcode = '55000';
  end if;
  update public.creator_profiles set status = 'pending', review_note = null where user_id = v_uid;
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id)
  values (null, v_uid, 'creator', 'creator_resubmit', v_uid);
end;
$$;
revoke execute on function public.request_creator_review() from public, anon, authenticated, service_role;
grant execute on function public.request_creator_review() to authenticated;

-- 審核列表：p_status = pending｜rejected｜approved｜suspended｜all；p_query 比對 handle、IG、名稱（不分大小寫、子字串）。
-- 待審核依申請時間由舊到新（先來先審），其他由新到舊。總數放在 total_count。
create function public.admin_list_creators(p_status text, p_query text, p_limit integer, p_offset integer)
returns table (
  user_id uuid, handle text, display_name text, ig_username text, follower_count integer, region text,
  categories text[], status text, review_note text, verification_code text, created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_q text := nullif(left(public.clean_text(p_query), 50), '');
  v_like text;
begin
  perform public.admin_actor();
  if p_status is null or p_status not in ('pending', 'rejected', 'approved', 'suspended', 'all') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  v_like := '%' || replace(replace(replace(coalesce(v_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  select cp.user_id, cp.handle, p.display_name, cp.ig_username, cp.follower_count, cp.region,
         cp.categories, cp.status, cp.review_note, v.code, cp.created_at,
         count(*) over ()
    from public.creator_profiles cp
    join public.profiles p on p.id = cp.user_id
    left join public.creator_verifications v on v.user_id = cp.user_id
   where (p_status = 'all' or cp.status = p_status)
     and (v_q is null or cp.handle ilike v_like or cp.ig_username ilike v_like or p.display_name ilike v_like)
   order by case when p_status = 'pending' then cp.created_at end asc,
            cp.created_at desc, cp.user_id
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_creators(text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_creators(text, text, integer, integer) to authenticated;

-- 5. 違規訊息（flagged_contact）的檢視紀錄。只有管理員讀得到；寫入只經由 mark_message_reviewed。
create table public.message_reviews (
  message_id uuid primary key references public.messages (id) on delete cascade,
  reviewed_by uuid,
  reviewed_at timestamptz not null default now()
);
alter table public.message_reviews enable row level security;
create policy message_reviews_admin_select on public.message_reviews
  for select to authenticated using (public.is_admin());
revoke all on public.message_reviews from anon, authenticated, service_role;
grant select on public.message_reviews to authenticated, service_role;

create index messages_flagged_idx on public.messages (created_at desc) where flagged_contact;

-- 標記已檢視：只能標記有 flagged_contact 的訊息；重複標記不報錯（回傳 false）。第一次標記寫 audit（message_reviewed）。
create function public.mark_message_reviewed(p_message_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_sender uuid;
  v_flagged boolean;
  v_inserted uuid;
begin
  select m.sender_id, m.flagged_contact into v_sender, v_flagged from public.messages m where m.id = p_message_id;
  if not found then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  if not v_flagged then
    raise exception 'message not flagged' using errcode = '22023';
  end if;
  insert into public.message_reviews (message_id, reviewed_by)
  values (p_message_id, case when v_actor = 'admin' then auth.uid() end)
  on conflict (message_id) do nothing
  returning message_id into v_inserted;
  if v_inserted is null then
    return false;
  end if;
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, case when v_actor = 'admin' then auth.uid() end, v_actor, 'message_reviewed', v_sender,
          'message ' || p_message_id::text);
  return true;
end;
$$;
revoke execute on function public.mark_message_reviewed(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_message_reviewed(uuid) to authenticated, service_role;

-- 違規訊息列表：p_view = open（未檢視）｜reviewed｜all；由新到舊。
create function public.admin_list_flagged_messages(p_view text, p_limit integer, p_offset integer)
returns table (
  id uuid, conversation_id uuid, body text, created_at timestamptz, sender_side text,
  brand_id uuid, brand_name text, creator_id uuid, creator_handle text, creator_name text,
  reviewed_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_actor();
  if p_view is null or p_view not in ('open', 'reviewed', 'all') then
    raise exception 'invalid view' using errcode = '22023';
  end if;
  return query
  select m.id, m.conversation_id, m.body, m.created_at,
         case when m.sender_id = cv.brand_id then 'brand' else 'creator' end,
         cv.brand_id, bp.brand_name, cv.creator_id, cp.handle, p.display_name,
         r.reviewed_at, count(*) over ()
    from public.messages m
    join public.conversations cv on cv.id = m.conversation_id
    left join public.brand_profiles bp on bp.user_id = cv.brand_id
    left join public.creator_profiles cp on cp.user_id = cv.creator_id
    left join public.profiles p on p.id = cv.creator_id
    left join public.message_reviews r on r.message_id = m.id
   where m.flagged_contact
     and (p_view = 'all' or (p_view = 'open') = (r.message_id is null))
   order by m.created_at desc, m.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_flagged_messages(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_flagged_messages(text, integer, integer) to authenticated;
