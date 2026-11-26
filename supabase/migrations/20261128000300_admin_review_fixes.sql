-- 計畫 9 資料庫審查修正。函式內容與 20261128000100_admin_core.sql、20261128000200_admin_money.sql、
-- 20261127000200_payment_review_fixes.sql 相同，只改下列處；權限重新宣告。
--   1. set_creator_status、mark_message_reviewed：管理員不能處理自己（admin is subject，42501）；service_role（system）不受影響
--   2. admin_record_lost_payment：先鎖付款單再鎖合作案（與綠界通知 record_payment_success 的順序相同，避免死結）；
--      admin_note 只在 record_payment_success 回 paid／paid_refund_required 時才寫（異常不寫）
--   3. 管理員補登觸發的付款異常 source = 'admin'（kollink.admin_recording 旗標）；payment_anomalies.source 允許 'admin'；去重仍以 (source, kind, 單號, 交易號) 為準
--   4. admin_mark_payout 多 p_expected_last4：撥款前確認創作者的收款帳戶末四碼沒變（變了 → 55000 payout account changed）
--   5. set_my_payout_account：戶名不可含控制字元（C0／C1，含中間的換行）

-- 3. payment_anomalies.source 增加 'admin'
alter table public.payment_anomalies drop constraint payment_anomalies_source_check;
alter table public.payment_anomalies
  add constraint payment_anomalies_source_check check (source in ('notify', 'payment_info', 'admin'));

create or replace function public.record_payment_anomaly(
  p_source text, p_kind text, p_merchant_trade_no text, p_provider_trade_no text,
  p_payment_id uuid, p_collab_id uuid, p_expected integer, p_received integer, p_raw jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
  v_status public.collab_status;
  -- 管理員補登（admin_record_*）呼叫 record_payment_success 時設定旗標，異常來源記為 admin
  v_source text := case when coalesce(current_setting('kollink.admin_recording', true), '') = 'on'
                        then 'admin' else p_source end;
begin
  insert into public.payment_anomalies
    (source, kind, merchant_trade_no, provider_trade_no, payment_id, collaboration_id,
     expected_amount_twd, received_amount_twd, raw)
  values
    (v_source, p_kind, left(coalesce(p_merchant_trade_no, ''), 64), left(coalesce(p_provider_trade_no, ''), 64),
     p_payment_id, p_collab_id, p_expected, p_received, public.payment_raw_whitelist(p_raw))
  on conflict (source, kind, merchant_trade_no, provider_trade_no) do nothing
  returning id into v_id;

  if v_id is not null and p_collab_id is not null then
    select c.status into v_status from public.collaborations c where c.id = p_collab_id;
    insert into public.audit_logs
      (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
    values
      (p_collab_id, null, 'system', 'payment_anomaly', v_status, v_status,
       null);  -- 金額等內部細節只留在 payment_anomalies（僅管理員可讀）；audit_logs 參與者看得到，不放備註
  end if;
  raise warning 'payment anomaly: % % %', p_kind, v_source, left(coalesce(p_merchant_trade_no, ''), 64);
end;
$$;
revoke execute on function public.record_payment_anomaly(text, text, text, text, uuid, uuid, integer, integer, jsonb)
  from public, anon, authenticated, service_role;

-- 管理員補登（線下付款）：同 20261128000200，只加 kollink.admin_recording 旗標
create or replace function public.admin_record_offline_payment(p_collab_id uuid, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_note text := public.admin_clean_note(p_note, 'note');
  c public.collaborations%rowtype;
  v_no text;
  v_res text;
begin
  c := public.admin_lock_collab(p_collab_id, v_actor);
  if c.status <> 'awaiting_payment' then
    raise exception 'collaboration not awaiting payment' using errcode = '55000';
  end if;
  -- MAN + 17 位大寫十六進位 = 20 字（payments.merchant_trade_no 上限 20、英數字）
  v_no := 'MAN' || upper(left(replace(gen_random_uuid()::text, '-', ''), 17));
  insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd, created_by, admin_note)
  values (c.id, 'ecpay', v_no, c.amount_twd, case when v_actor = 'admin' then auth.uid() end, v_note);
  perform set_config('kollink.admin_recording', 'on', true);
  v_res := public.record_payment_success(v_no, c.amount_twd, 'MANUAL-' || v_no, '{"source":"admin"}'::jsonb, null);
  perform set_config('kollink.admin_recording', 'off', true);
  return v_res;
end;
$$;
revoke execute on function public.admin_record_offline_payment(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_offline_payment(uuid, text) to authenticated, service_role;

-- 2、3. 通知遺失補登：先鎖付款單（與 record_payment_success 相同的 payment → collaboration 順序），再鎖合作案
create or replace function public.admin_record_lost_payment(
  p_merchant_trade_no text, p_provider_trade_no text, p_amount_twd integer, p_env text, p_note text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_note text := public.admin_clean_note(p_note, 'note');
  v_ptn text := btrim(coalesce(p_provider_trade_no, ''));
  p public.payments%rowtype;
  v_res text;
begin
  if p_env is null or p_env not in ('stage', 'prod') then
    raise exception 'invalid env' using errcode = '22023';
  end if;
  if v_ptn !~ '^[A-Za-z0-9]{1,20}$' then
    raise exception 'invalid provider_trade_no' using errcode = '22023';
  end if;
  if p_amount_twd is null or p_amount_twd <= 0 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  select * into p from public.payments where merchant_trade_no = p_merchant_trade_no for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  if p.merchant_trade_no !~ '^KL' then
    raise exception 'not an online payment' using errcode = '22023';
  end if;
  perform public.admin_lock_collab(p.collaboration_id, v_actor);
  perform set_config('kollink.admin_recording', 'on', true);
  v_res := public.record_payment_success(p.merchant_trade_no, p_amount_twd, v_ptn, '{"source":"admin"}'::jsonb, p_env);
  perform set_config('kollink.admin_recording', 'off', true);
  if v_res in ('paid', 'paid_refund_required') then
    update public.payments set admin_note = v_note where id = p.id;
  end if;
  return v_res;
end;
$$;
revoke execute on function public.admin_record_lost_payment(text, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_lost_payment(text, text, integer, text, text) to authenticated, service_role;

-- 1. 管理員不能處理自己
create or replace function public.set_creator_status(p_user_id uuid, p_action text, p_reason text default null)
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
  if v_actor = 'admin' and p_user_id = auth.uid() then
    raise exception 'admin is subject' using errcode = '42501';
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

create or replace function public.mark_message_reviewed(p_message_id uuid) returns boolean
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
  if v_actor = 'admin' and v_sender = auth.uid() then
    raise exception 'admin is subject' using errcode = '42501';
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

-- 4. 撥款：多 p_expected_last4（管理員畫面上看到的帳號末四碼）。換簽章，舊函式移除。
drop function public.admin_mark_payout(uuid, text);
create function public.admin_mark_payout(p_collab_id uuid, p_note text, p_expected_last4 text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_note text := public.admin_clean_note(p_note, 'note');
  c public.collaborations%rowtype;
  a public.creator_payout_accounts%rowtype;
begin
  c := public.admin_lock_collab(p_collab_id, v_actor);
  if c.status <> 'awaiting_payout' then
    raise exception 'collaboration not awaiting payout' using errcode = '55000';
  end if;
  if exists (select 1 from public.payments p
              where p.collaboration_id = c.id and p.status = 'paid' and not p.refund_required
                and p.provider_env = 'stage') then
    raise exception 'test payment cannot be paid out' using errcode = '55000';
  end if;
  if not exists (select 1 from public.payments p
                  where p.collaboration_id = c.id and p.status = 'paid' and not p.refund_required
                    and p.refunded_at is null) then
    raise exception 'no paid payment' using errcode = '55000';
  end if;
  if exists (select 1 from public.payments p where p.collaboration_id = c.id and p.refund_required) then
    raise exception 'refund pending' using errcode = '55000';
  end if;
  select * into a from public.creator_payout_accounts where user_id = c.creator_id;
  if not found then
    raise exception 'payout account missing' using errcode = '55000';
  end if;
  -- 管理員看到帳號之後創作者可能改了帳戶：末四碼不同就拒絕，請重新整理確認
  if p_expected_last4 is distinct from a.account_last4 then
    raise exception 'payout account changed' using errcode = '55000';
  end if;

  insert into public.collaboration_payouts
    (collaboration_id, amount_twd, bank_code, branch_code, account_last4, account_name, transfer_note, actor_kind, paid_out_by)
  values
    (c.id, c.amount_twd, a.bank_code, a.branch_code, a.account_last4, a.account_name, v_note, v_actor,
     case when v_actor = 'admin' then auth.uid() end);

  perform set_config('kollink.paying_out', 'on', true);
  perform public.transition_collaboration(c.id, 'payout');
  perform set_config('kollink.paying_out', 'off', true);
end;
$$;
revoke execute on function public.admin_mark_payout(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_mark_payout(uuid, text, text) to authenticated, service_role;

-- 5. 戶名不可含控制字元（C0／C1，含 clean_text 沒去掉的中間換行）
create or replace function public.set_my_payout_account(
  p_bank_code text, p_branch_code text, p_account_number text, p_account_name text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_bank text := regexp_replace(coalesce(p_bank_code, ''), '[\s-]', '', 'g');
  v_branch text := nullif(regexp_replace(coalesce(p_branch_code, ''), '[\s-]', '', 'g'), '');
  v_account text := regexp_replace(coalesce(p_account_number, ''), '[\s-]', '', 'g');
  v_name text := nullif(public.clean_text(p_account_name), '');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.creator_profiles cp where cp.user_id = v_uid) then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_bank !~ '^[0-9]{3}$' then
    raise exception 'invalid bank_code' using errcode = '22023';
  end if;
  if v_branch is not null and v_branch !~ '^[0-9]{4}$' then
    raise exception 'invalid branch_code' using errcode = '22023';
  end if;
  if v_account !~ '^[0-9]{7,16}$' then
    raise exception 'invalid account_number' using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) > 40 or public.has_bidi(v_name)
     or v_name ~ E'[\u0001-\u001f\u007f-\u009f]' then
    raise exception 'invalid account_name' using errcode = '22023';
  end if;

  insert into public.creator_payout_accounts (user_id, bank_code, branch_code, account_number, account_name)
  values (v_uid, v_bank, v_branch, v_account, v_name)
  on conflict (user_id) do update
    set bank_code = excluded.bank_code, branch_code = excluded.branch_code,
        account_number = excluded.account_number, account_name = excluded.account_name, updated_at = now();

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, v_uid, 'creator', 'payout_account_updated', v_uid, v_bank || ' ****' || right(v_account, 4));
end;
$$;
revoke execute on function public.set_my_payout_account(text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_my_payout_account(text, text, text, text) to authenticated;
