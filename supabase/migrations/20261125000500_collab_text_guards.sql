-- 計畫 6 最終審查修正：transition_collaboration 對 p_note 與貼文網址做伺服器端檢查（與 app 規則一致）。
-- 只用 create or replace，簽名與權限不變；其餘邏輯與 20261125000400 完全相同。

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
  -- 與 src/lib/validation/collab.ts 的 NOTE_MAX（1000）、POST_URL_MAX（500）、hasBadChar 一致
  v_note text := nullif(public.clean_text(p_note), '');
  v_url text := nullif(public.clean_text(p_published_url), '');
begin
  if v_note is not null and (public.has_bidi(v_note) or char_length(v_note) > 1000) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  if v_url is not null and (public.has_bidi(v_url) or char_length(v_url) > 500) then
    raise exception 'invalid published_url' using errcode = '22023';
  end if;

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
         and v_note is not null
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_publish' and p_action = 'publish' and v_actor = 'creator'
         and v_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/\S+$'
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
      published_url = case when v_to = 'awaiting_payout' then v_url else published_url end
  where id = c.id;
  perform set_config('kollink.in_transition', 'off', true);

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values (c.id, case when v_actor = 'system' then null else v_uid end, v_actor, p_action, c.status, v_to, v_note);

  return v_to;
end;
$$;
