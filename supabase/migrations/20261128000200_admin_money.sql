-- 計畫 9：管理後台（二）收款帳戶、人工標記已付款、撥款、平台取消、款項列表
-- 規則見 docs/superpowers/specs/2026-11-27-admin-design.md。

-- 1. 創作者收款帳戶（敏感資料）：本人與管理員可讀，但 account_number 不開放任何 API 角色直接讀；
--    本人與列表只看得到末四碼（account_last4），完整帳號只能經由 admin_get_payout_account（撥款畫面、寫 audit）。
--    寫入只經由 set_my_payout_account。規則與 src/lib/payout-account.ts 相同。
create table public.creator_payout_accounts (
  user_id uuid primary key references public.creator_profiles (user_id) on delete cascade,
  bank_code text not null check (bank_code ~ '^[0-9]{3}$'),
  branch_code text check (branch_code is null or branch_code ~ '^[0-9]{4}$'),
  account_number text not null check (account_number ~ '^[0-9]{7,16}$'),
  account_last4 text generated always as (right(account_number, 4)) stored,
  account_name text not null check (char_length(account_name) between 1 and 40),
  updated_at timestamptz not null default now()
);
alter table public.creator_payout_accounts enable row level security;
create policy creator_payout_accounts_select on public.creator_payout_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.creator_payout_accounts from anon, authenticated, service_role;
grant select (user_id, bank_code, branch_code, account_last4, account_name, updated_at)
  on public.creator_payout_accounts to authenticated;

-- 創作者自己設定（任何審核狀態都可以先填）。輸入的空白與「-」會去掉。每次修改寫 audit（payout_account_updated）。
create function public.set_my_payout_account(
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
  if v_name is null or char_length(v_name) > 40 or public.has_bidi(v_name) then
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

-- 2. payments.admin_note：人工標記已付款時管理員寫的說明（authenticated 的欄位權限不含這欄，與 refund_note 相同）
alter table public.payments
  add column admin_note text check (admin_note is null or char_length(admin_note) between 1 and 500);

-- 3. 撥款紀錄：撥款當下的帳戶快照（只留末四碼）與轉帳說明。只有管理員讀得到；寫入只經由 admin_mark_payout。
create table public.collaboration_payouts (
  collaboration_id uuid primary key references public.collaborations (id),
  amount_twd integer not null check (amount_twd > 0),
  bank_code text not null,
  branch_code text,
  account_last4 text not null,
  account_name text not null,
  transfer_note text not null check (char_length(transfer_note) between 1 and 500),
  actor_kind text not null check (actor_kind in ('admin', 'system')),
  paid_out_by uuid,
  created_at timestamptz not null default now()
);
alter table public.collaboration_payouts enable row level security;
create policy collaboration_payouts_admin_select on public.collaboration_payouts
  for select to authenticated using (public.is_admin());
revoke all on public.collaboration_payouts from anon, authenticated, service_role;
grant select on public.collaboration_payouts to authenticated, service_role;

-- 4. transition_collaboration：與 20261125000500_collab_text_guards.sql 相同，只改三處
--    a) mark_paid：管理員（經由 admin_record_* 呼叫 record_payment_success）也可以，仍然只能在 kollink.recording_payment 旗標下
--    b) payout：只能經由 admin_mark_payout（kollink.paying_out 旗標），不能直接呼叫跳過測試付款與收款帳戶檢查
--    c) admin_cancel：平台取消（爭議處理），任何未結束的狀態，只能經由 admin_cancel_collaboration（kollink.admin_cancelling 旗標），原因必填
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
    when c.status = 'awaiting_payment' and p_action = 'mark_paid' and v_actor in ('system', 'admin')
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
         and coalesce(current_setting('kollink.paying_out', true), '') = 'on'
      then 'completed'::public.collab_status
    when c.status in ('invited', 'awaiting_payment', 'awaiting_submission', 'in_review',
                      'awaiting_publish', 'awaiting_payout')
         and p_action = 'admin_cancel' and v_actor in ('admin', 'system')
         and coalesce(current_setting('kollink.admin_cancelling', true), '') = 'on'
         and v_note is not null
      then 'cancelled'::public.collab_status
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
revoke execute on function public.transition_collaboration(uuid, text, text, text) from public, anon;
grant execute on function public.transition_collaboration(uuid, text, text, text) to authenticated, service_role;

-- 管理員是合作案的參與者時，不能用管理員身分處理自己的案子（與 transition_collaboration 的身分優先相同）。
create function public.admin_lock_collab(p_collab_id uuid, p_actor text) returns public.collaborations
language plpgsql security definer set search_path = '' as $$
declare
  c public.collaborations%rowtype;
begin
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if p_actor = 'admin' and auth.uid() in (c.brand_id, c.creator_id) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  return c;
end;
$$;
revoke execute on function public.admin_lock_collab(uuid, text) from public, anon, authenticated, service_role;

-- 5. 人工標記已付款：線下付款／超過線上付款上限（取代 README 的 MAN 單 SQL）
--    建一張 MAN 開頭的付款單（金額 = 合作案報價、admin_note = 說明），再呼叫 record_payment_success。
--    回傳 record_payment_success 的結果（正常是 paid）。
create function public.admin_record_offline_payment(p_collab_id uuid, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_note text := public.admin_clean_note(p_note, 'note');
  c public.collaborations%rowtype;
  v_no text;
begin
  c := public.admin_lock_collab(p_collab_id, v_actor);
  if c.status <> 'awaiting_payment' then
    raise exception 'collaboration not awaiting payment' using errcode = '55000';
  end if;
  -- MAN + 17 位大寫十六進位 = 20 字（payments.merchant_trade_no 上限 20、英數字）
  v_no := 'MAN' || upper(left(replace(gen_random_uuid()::text, '-', ''), 17));
  insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd, created_by, admin_note)
  values (c.id, 'ecpay', v_no, c.amount_twd, case when v_actor = 'admin' then auth.uid() end, v_note);
  return public.record_payment_success(v_no, c.amount_twd, 'MANUAL-' || v_no, '{"source":"admin"}'::jsonb, null);
end;
$$;
revoke execute on function public.admin_record_offline_payment(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_offline_payment(uuid, text) to authenticated, service_role;

-- 綠界已扣款、但沒收到通知（已在綠界廠商後台確認）：用既有的 KL 付款單呼叫 record_payment_success。
-- p_env 是建單時的綠界環境（App 由 ECPAY_ENV 帶入；stage 的款項之後不能撥款）。
-- 回傳 paid｜already_paid｜paid_refund_required｜anomaly（金額與付款單不符時記錄為付款異常）。
create function public.admin_record_lost_payment(
  p_merchant_trade_no text, p_provider_trade_no text, p_amount_twd integer, p_env text, p_note text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_note text := public.admin_clean_note(p_note, 'note');
  v_ptn text := btrim(coalesce(p_provider_trade_no, ''));
  p public.payments%rowtype;
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
  select * into p from public.payments where merchant_trade_no = p_merchant_trade_no;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  if p.merchant_trade_no !~ '^KL' then
    raise exception 'not an online payment' using errcode = '22023';
  end if;
  perform public.admin_lock_collab(p.collaboration_id, v_actor);
  if p.status <> 'paid' then
    update public.payments set admin_note = v_note where id = p.id;
  end if;
  return public.record_payment_success(p.merchant_trade_no, p_amount_twd, v_ptn, '{"source":"admin"}'::jsonb, p_env);
end;
$$;
revoke execute on function public.admin_record_lost_payment(text, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_lost_payment(text, text, integer, text, text) to authenticated, service_role;

-- 6. 撥款（awaiting_payout → completed）：管理員在平台外轉帳後標記。
--    拒絕：測試付款（provider_env = stage）、沒有已付款的款項、有待退款的款項、創作者沒有收款帳戶。
--    在 collaboration_payouts 留下帳戶快照（末四碼）與轉帳說明；audit 的 payout 列不放說明（參與者看得到）。
create function public.admin_mark_payout(p_collab_id uuid, p_note text) returns void
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
revoke execute on function public.admin_mark_payout(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_mark_payout(uuid, text) to authenticated, service_role;

-- 撥款畫面看完整帳號：只在合作案 awaiting_payout 時回傳；每位管理員對同一位創作者 10 分鐘內只記一筆 audit（payout_account_viewed）。
create function public.admin_get_payout_account(p_collab_id uuid)
returns table (bank_code text, branch_code text, account_number text, account_name text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_actor text := public.admin_actor();
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
begin
  select * into c from public.collaborations where id = p_collab_id;
  if not found or c.status <> 'awaiting_payout' then
    return;
  end if;
  if v_actor = 'admin' and v_uid in (c.brand_id, c.creator_id) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  if not exists (select 1 from public.creator_payout_accounts a where a.user_id = c.creator_id) then
    return;
  end if;
  if not exists (select 1 from public.audit_logs l
                  where l.subject_id = c.creator_id and l.action = 'payout_account_viewed'
                    and l.actor_id is not distinct from (case when v_actor = 'admin' then v_uid end)
                    and l.created_at > now() - interval '10 minutes') then
    insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
    values (null, case when v_actor = 'admin' then v_uid end, v_actor, 'payout_account_viewed', c.creator_id,
            'case ' || left(c.id::text, 8));
  end if;
  return query
  select a.bank_code, a.branch_code, a.account_number, a.account_name, a.updated_at
    from public.creator_payout_accounts a where a.user_id = c.creator_id;
end;
$$;
revoke execute on function public.admin_get_payout_account(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_payout_account(uuid) to authenticated, service_role;

-- 7. 平台取消（爭議處理）：任何未結束的狀態 → cancelled，原因必填（雙方在事件裡看得到）。
--    已付款且還沒退款的款項一律標記需退款（refund_required），並寫一筆 refund_scheduled。回傳標記了幾筆。
create function public.admin_cancel_collaboration(p_collab_id uuid, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_reason text := public.admin_clean_note(p_reason, 'reason');
  c public.collaborations%rowtype;
  v_n integer;
begin
  c := public.admin_lock_collab(p_collab_id, v_actor);
  if c.status in ('completed', 'declined', 'cancelled') then
    raise exception 'collaboration already closed' using errcode = '55000';
  end if;
  perform set_config('kollink.admin_cancelling', 'on', true);
  perform public.transition_collaboration(c.id, 'admin_cancel', v_reason);
  perform set_config('kollink.admin_cancelling', 'off', true);

  update public.payments p set refund_required = true
   where p.collaboration_id = c.id and p.status = 'paid' and not p.refund_required and p.refunded_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status)
    values (c.id, case when v_actor = 'admin' then auth.uid() end, v_actor, 'refund_scheduled',
            'cancelled', 'cancelled');
  end if;
  return v_n;
end;
$$;
revoke execute on function public.admin_cancel_collaboration(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_cancel_collaboration(uuid, text) to authenticated, service_role;

-- 8. 列表（只給管理員）
-- 合作案：p_status = active（未結束）｜all｜任一個 collab_status；p_query = 案號（8 碼 id 前綴）或案名、品牌名稱、創作者 handle 的子字串。
create function public.admin_list_collaborations(p_status text, p_query text, p_limit integer, p_offset integer)
returns table (
  id uuid, title text, amount_twd integer, status text, created_at timestamptz, updated_at timestamptz,
  brand_name text, creator_handle text, creator_name text,
  paid boolean, test_paid boolean, refund_pending boolean, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_q text := nullif(left(public.clean_text(p_query), 50), '');
  v_like text;
  v_code text;
begin
  perform public.admin_actor();
  if p_status is null or (p_status not in ('active', 'all')
     and p_status not in (select unnest(enum_range(null::public.collab_status))::text)) then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  v_like := '%' || replace(replace(replace(coalesce(v_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_code := case when lower(coalesce(v_q, '')) ~ '^[0-9a-f]{8}$' then lower(v_q) end;
  return query
  select c.id, c.title, c.amount_twd, c.status::text, c.created_at, c.updated_at,
         bp.brand_name, cp.handle, p.display_name,
         exists (select 1 from public.payments x where x.collaboration_id = c.id and x.status = 'paid'),
         exists (select 1 from public.payments x where x.collaboration_id = c.id and x.status = 'paid'
                   and x.provider_env = 'stage'),
         exists (select 1 from public.payments x where x.collaboration_id = c.id and x.refund_required),
         count(*) over ()
    from public.collaborations c
    left join public.brand_profiles bp on bp.user_id = c.brand_id
    left join public.creator_profiles cp on cp.user_id = c.creator_id
    left join public.profiles p on p.id = c.creator_id
   where (p_status = 'all'
          or (p_status = 'active' and c.status not in ('completed', 'declined', 'cancelled'))
          or c.status::text = p_status)
     and (v_q is null
          or (v_code is not null and c.id::text like v_code || '%')
          or c.title ilike v_like or bp.brand_name ilike v_like or cp.handle ilike v_like)
   order by c.updated_at desc, c.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_collaborations(text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_collaborations(text, text, integer, integer) to authenticated;

-- 付款單：p_view = all｜pending｜paid｜refund（需退款）；p_collab_id 不是 null 時只列這個合作案。由新到舊。
create function public.admin_list_payments(p_view text, p_limit integer, p_offset integer, p_collab_id uuid default null)
returns table (
  id uuid, collaboration_id uuid, merchant_trade_no text, provider_trade_no text, amount_twd integer,
  status text, payment_method text, provider_env text, paid_at timestamptz, created_at timestamptz,
  refund_required boolean, refunded_at timestamptz, refund_note text, admin_note text,
  collab_title text, collab_status text, brand_name text, creator_handle text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_actor();
  if p_view is null or p_view not in ('all', 'pending', 'paid', 'refund') then
    raise exception 'invalid view' using errcode = '22023';
  end if;
  return query
  select x.id, x.collaboration_id, x.merchant_trade_no, x.provider_trade_no, x.amount_twd,
         x.status, x.payment_method, x.provider_env, x.paid_at, x.created_at,
         x.refund_required, x.refunded_at, x.refund_note, x.admin_note,
         c.title, c.status::text, bp.brand_name, cp.handle, count(*) over ()
    from public.payments x
    join public.collaborations c on c.id = x.collaboration_id
    left join public.brand_profiles bp on bp.user_id = c.brand_id
    left join public.creator_profiles cp on cp.user_id = c.creator_id
   where (p_collab_id is null or x.collaboration_id = p_collab_id)
     and (p_view = 'all'
          or (p_view = 'pending' and x.status = 'pending')
          or (p_view = 'paid' and x.status = 'paid')
          or (p_view = 'refund' and x.refund_required))
   order by x.created_at desc, x.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_payments(text, integer, integer, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_payments(text, integer, integer, uuid) to authenticated;

-- 待撥款：awaiting_payout 的合作案，依等待時間由舊到新；收款帳戶只回傳銀行代碼與末四碼。
create function public.admin_list_payouts(p_limit integer, p_offset integer)
returns table (
  id uuid, title text, amount_twd integer, updated_at timestamptz, brand_name text,
  creator_id uuid, creator_handle text, creator_name text,
  bank_code text, account_last4 text, account_updated_at timestamptz,
  test_paid boolean, refund_pending boolean, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_actor();
  return query
  select c.id, c.title, c.amount_twd, c.updated_at, bp.brand_name,
         c.creator_id, cp.handle, p.display_name,
         a.bank_code, a.account_last4, a.updated_at,
         exists (select 1 from public.payments x where x.collaboration_id = c.id and x.status = 'paid'
                   and not x.refund_required and x.provider_env = 'stage'),
         exists (select 1 from public.payments x where x.collaboration_id = c.id and x.refund_required),
         count(*) over ()
    from public.collaborations c
    left join public.brand_profiles bp on bp.user_id = c.brand_id
    left join public.creator_profiles cp on cp.user_id = c.creator_id
    left join public.profiles p on p.id = c.creator_id
    left join public.creator_payout_accounts a on a.user_id = c.creator_id
   where c.status = 'awaiting_payout'
   order by c.updated_at asc, c.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_list_payouts(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_payouts(integer, integer) to authenticated;

-- 總覽的待辦數字
create function public.admin_overview()
returns table (
  pending_creators bigint, awaiting_payment bigint, awaiting_payout bigint,
  refund_required bigint, open_anomalies bigint, open_flagged_messages bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_actor();
  return query
  select (select count(*) from public.creator_profiles cp where cp.status = 'pending'),
         (select count(*) from public.collaborations c where c.status = 'awaiting_payment'),
         (select count(*) from public.collaborations c where c.status = 'awaiting_payout'),
         (select count(*) from public.payments x where x.refund_required),
         (select count(*) from public.payment_anomalies a where a.resolved_at is null),
         (select count(*) from public.messages m
           where m.flagged_contact
             and not exists (select 1 from public.message_reviews r where r.message_id = m.id));
end;
$$;
revoke execute on function public.admin_overview() from public, anon, authenticated, service_role;
grant execute on function public.admin_overview() to authenticated;
