-- 計畫 6 資料庫審查修正：交稿只能經由 submit_deliverables、variable_conflict、cron 鎖列、storage helper 與判斷順序無關。
-- 全部用 create or replace，簽名與權限不變（create or replace 保留既有 grant）。

-- 1. transition_collaboration：submit 只能在 submit_deliverables 設定 kollink.submitting_deliverables = 'on' 時成立
--    （與 kollink.recording_payment 同一種做法；PostgREST 每個 RPC 一個 transaction，呼叫者無法預先 set_config）。
create or replace function public.transition_collaboration(
  p_collab_id uuid,
  p_action text,
  p_note text default null,
  p_published_url text default null
) returns public.collab_status
language plpgsql security definer set search_path = '' as $$
declare
  c public.collaborations%rowtype;
  v_uid uuid := auth.uid();
  v_actor text;
  v_to public.collab_status;
begin
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found then
    raise exception 'collaboration % not found', p_collab_id using errcode = 'P0002';
  end if;

  -- 身分優先順序：system > brand > creator > admin（參與者永遠以參與者身分行動）
  if coalesce(auth.role(), '') = 'service_role'
     and coalesce(current_setting('role', true), '') = 'service_role' then
    v_actor := 'system';
  elsif v_uid = c.brand_id then
    v_actor := 'brand';
  elsif v_uid = c.creator_id then
    v_actor := 'creator';
  elsif public.is_admin() then
    v_actor := 'admin';
  else
    raise exception 'not a participant of collaboration %', p_collab_id using errcode = '42501';
  end if;

  v_to := case
    when c.status = 'invited' and p_action = 'accept' and v_actor = 'creator'
      then 'awaiting_payment'::public.collab_status
    when c.status = 'invited' and p_action = 'decline' and v_actor = 'creator'
      then 'declined'::public.collab_status
    when c.status in ('invited', 'awaiting_payment') and p_action = 'cancel' and v_actor = 'brand'
      then 'cancelled'::public.collab_status
    when c.status = 'awaiting_payment' and p_action = 'mark_paid' and v_actor = 'system'
         and coalesce(current_setting('kollink.recording_payment', true), '') = 'on'
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_submission' and p_action = 'submit' and v_actor = 'creator'
         and coalesce(current_setting('kollink.submitting_deliverables', true), '') = 'on'
      then 'in_review'::public.collab_status
    when c.status = 'in_review' and p_action = 'approve' and v_actor = 'brand'
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'auto_approve' and v_actor = 'system'
         and c.review_due_at <= now()
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'request_changes' and v_actor = 'brand'
         and nullif(btrim(p_note, E' \t\r\n' || U&'\3000'), '') is not null
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_publish' and p_action = 'publish' and v_actor = 'creator'
         and p_published_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/\S+$'
      then 'awaiting_payout'::public.collab_status
    when c.status = 'awaiting_payout' and p_action = 'payout' and v_actor in ('admin', 'system')
      then 'completed'::public.collab_status
    else null
  end;

  if v_to is null then
    raise exception 'invalid transition: % from % by %', p_action, c.status, v_actor
      using errcode = '22023';
  end if;

  perform set_config('kollink.in_transition', 'on', true);
  update public.collaborations
  set status = v_to,
      updated_at = now(),
      review_due_at = case when v_to = 'in_review' then now() + interval '3 days' else review_due_at end,
      published_url = case when v_to = 'awaiting_payout' then p_published_url else published_url end
  where id = c.id;
  perform set_config('kollink.in_transition', 'off', true);

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values (c.id, case when v_actor = 'system' then null else v_uid end, v_actor, p_action, c.status, v_to, p_note);

  return v_to;
end;
$$;

-- 2. submit_deliverables：呼叫 transition 前後設定／清除 GUC
create or replace function public.submit_deliverables(
  p_collab_id uuid, p_note text default null, p_links text[] default '{}', p_file_paths text[] default '{}'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_note text := nullif(public.clean_text(p_note), '');
  v_links text[];
  v_files text[] := coalesce(p_file_paths, '{}');
  v_round integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found or (c.brand_id <> v_uid and c.creator_id <> v_uid) then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if c.creator_id <> v_uid then
    raise exception 'not collaboration creator' using errcode = '42501';
  end if;
  if c.status <> 'awaiting_submission' then
    raise exception 'collaboration not awaiting submission' using errcode = '55000';
  end if;
  if v_note is not null and (public.has_bidi(v_note) or char_length(v_note) > 1000) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select coalesce(array_agg(public.clean_text(l) order by o), '{}') into v_links
    from unnest(coalesce(p_links, '{}')) with ordinality as t(l, o);
  if cardinality(v_links) > 5 or exists (
       select 1 from unnest(v_links) l
        where l is null or char_length(l) > 500 or public.has_bidi(l)
           or l !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/\S*)?$'
     ) then
    raise exception 'invalid links' using errcode = '22023';
  end if;
  if cardinality(v_files) > 10
     or cardinality(v_files) <> (select count(distinct f) from unnest(v_files) f)
     or exists (
       select 1 from unnest(v_files) f
        where f is null
           or not public.deliverable_path_ok(c.id, c.creator_id, f)
           or not exists (select 1 from storage.objects o where o.bucket_id = 'deliverables' and o.name = f)
     ) then
    raise exception 'invalid file_paths' using errcode = '22023';
  end if;
  if cardinality(v_links) + cardinality(v_files) = 0 then
    raise exception 'empty submission' using errcode = '22023';
  end if;

  select coalesce(max(s.round), 0) + 1 into v_round
    from public.collaboration_submissions s where s.collaboration_id = c.id;
  insert into public.collaboration_submissions (collaboration_id, round, note, links, file_paths)
  values (c.id, v_round, v_note, v_links, v_files);
  perform set_config('kollink.submitting_deliverables', 'on', true);
  perform public.transition_collaboration(c.id, 'submit');
  perform set_config('kollink.submitting_deliverables', 'off', true);
  return v_round;
end;
$$;

-- 3. check_collab_offer：加 #variable_conflict use_column（RETURNS TABLE 的 title/deliverables 與欄位同名）
create or replace function public.check_collab_offer(p_title text, p_deliverables text, p_amount_twd integer)
returns table (title text, deliverables text)
language plpgsql immutable set search_path = '' as $$
#variable_conflict use_column
declare
  v_title text := nullif(public.clean_text(p_title), '');
  v_deliverables text := nullif(public.clean_text(p_deliverables), '');
begin
  if v_title is null or public.has_bidi(v_title) or char_length(v_title) > 60 then
    raise exception 'invalid title' using errcode = '22023';
  end if;
  if v_deliverables is null or public.has_bidi(v_deliverables) or char_length(v_deliverables) > 1000 then
    raise exception 'invalid deliverables' using errcode = '22023';
  end if;
  if p_amount_twd is null or p_amount_twd not between 1 and 10000000 then
    raise exception 'invalid amount_twd' using errcode = '22023';
  end if;
  return query select v_title, v_deliverables;
end;
$$;

-- 4. auto_approve_due：#variable_conflict use_column + for update of c skip locked（重疊的 cron 不會把對方處理中的列當成失敗）
create or replace function public.auto_approve_due()
returns table (approved integer, failed uuid[])
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  r record;
  v_ok integer := 0;
  v_failed uuid[] := '{}';
begin
  for r in
    select c.id from public.collaborations c
     where c.status = 'in_review' and c.review_due_at <= now()
     order by c.review_due_at, c.id
     for update of c skip locked
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

-- 5. storage helper：uuid 轉型放進 case，不依賴 AND 的求值順序
create or replace function public.can_read_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
       where c.id = case
               when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
               then split_part(p_name, '/', 1)::uuid
             end
         and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
$$;
create or replace function public.can_upload_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.collaborations c
     where c.id = case
             when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
             then split_part(p_name, '/', 1)::uuid
           end
       and c.creator_id = auth.uid()
       and c.status = 'awaiting_submission'
       and public.deliverable_path_ok(c.id, c.creator_id, p_name)
  );
$$;
