-- 計畫 8：綠界金流（建單、付款通知、ATM 取號通知、付款異常、退款標記）
-- 規則與 docs/superpowers/specs/2026-11-26-payments-design.md 相同。

-- 1. payments 新欄位與限制
--    payment_method／created_by：只有 create_payment_order 建的單才有（本機按鈕與 README 人工 SQL 是 null）
--    provider_env：哪一組綠界金鑰驗證過付款通知（stage = 測試付款，不能撥款）；人工與本機是 null
--    atm_*：ATM 取號結果（PaymentInfoURL）
alter table public.payments
  add column payment_method text check (payment_method in ('credit', 'atm')),
  add column provider_env text check (provider_env in ('stage', 'prod')),
  add column created_by uuid,
  add column atm_bank_code text check (atm_bank_code ~ '^[0-9]{3}$'),
  add column atm_v_account text check (atm_v_account ~ '^[0-9]{6,16}$'),
  add column atm_expire_date date,
  add column payment_info_at timestamptz,
  add column refunded_at timestamptz,
  add column refund_note text check (refund_note is null or char_length(refund_note) between 1 and 500);
alter table public.payments
  add constraint payments_provider_trade_no_not_blank
    check (provider_trade_no is null or btrim(provider_trade_no) <> ''),
  add constraint payments_refund_state check (refunded_at is null or not refund_required);
create index payments_collab_created_idx on public.payments (collaboration_id, created_at desc);

-- 參與者可讀的欄位：raw_notify（綠界原始通知）、created_by、refund_note 只給 service_role
revoke select on public.payments from anon, authenticated;
grant select (id, collaboration_id, provider, merchant_trade_no, amount_twd, status, provider_trade_no, paid_at,
              refund_required, created_at, payment_method, provider_env, atm_bank_code, atm_v_account,
              atm_expire_date, payment_info_at, refunded_at)
  on public.payments to authenticated;

-- 2. 付款異常：金額不符、找不到付款單等。綠界只重送 4 次，所以不報錯，記下來給管理員處理。
create table public.payment_anomalies (
  id bigint generated always as identity primary key,
  source text not null check (source in ('notify', 'payment_info')),
  kind text not null check (kind in ('unknown_trade_no', 'amount_mismatch', 'price_mismatch')),
  merchant_trade_no text not null check (char_length(merchant_trade_no) <= 64),
  provider_trade_no text not null default '' check (char_length(provider_trade_no) <= 64),
  payment_id uuid references public.payments (id),
  collaboration_id uuid references public.collaborations (id),
  expected_amount_twd integer,
  received_amount_twd integer,
  raw jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_note text check (resolved_note is null or char_length(resolved_note) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint payment_anomalies_resolved check ((resolved_at is null) = (resolved_note is null))
);
-- 同一筆通知重送只記一次
create unique index payment_anomalies_dedupe
  on public.payment_anomalies (source, kind, merchant_trade_no, provider_trade_no);
create index payment_anomalies_open_idx on public.payment_anomalies (created_at) where resolved_at is null;

alter table public.payment_anomalies enable row level security;
create policy payment_anomalies_admin_select on public.payment_anomalies
  for select to authenticated using (public.is_admin());
revoke all on public.payment_anomalies from anon, authenticated, service_role;
grant select on public.payment_anomalies to authenticated, service_role;

-- 3. raw_notify 白名單（src/lib/payments/notify-fields.ts 的 NOTIFY_FIELDS 必須相同）：
--    不保存 card4no、card6no、ATMAccNo 等付款人資料，即使綠界之後多傳了欄位。
create function public.payment_raw_whitelist(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) e
   where e.key in ('MerchantID', 'MerchantTradeNo', 'StoreID', 'RtnCode', 'RtnMsg', 'TradeNo', 'TradeAmt',
                   'PaymentDate', 'PaymentType', 'PaymentTypeChargeFee', 'TradeDate', 'SimulatePaid',
                   'BankCode', 'vAccount', 'ExpireDate', 'source');
$$;
revoke execute on function public.payment_raw_whitelist(jsonb) from public, anon, authenticated, service_role;

-- 4. 記錄一筆異常（內部 helper，不授權給 API 角色）。第一次記錄時，若知道合作案，另寫 audit（payment_anomaly）。
create function public.record_payment_anomaly(
  p_source text, p_kind text, p_merchant_trade_no text, p_provider_trade_no text,
  p_payment_id uuid, p_collab_id uuid, p_expected integer, p_received integer, p_raw jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
  v_status public.collab_status;
begin
  insert into public.payment_anomalies
    (source, kind, merchant_trade_no, provider_trade_no, payment_id, collaboration_id,
     expected_amount_twd, received_amount_twd, raw)
  values
    (p_source, p_kind, left(coalesce(p_merchant_trade_no, ''), 64), left(coalesce(p_provider_trade_no, ''), 64),
     p_payment_id, p_collab_id, p_expected, p_received, public.payment_raw_whitelist(p_raw))
  on conflict (source, kind, merchant_trade_no, provider_trade_no) do nothing
  returning id into v_id;

  if v_id is not null and p_collab_id is not null then
    select c.status into v_status from public.collaborations c where c.id = p_collab_id;
    insert into public.audit_logs
      (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
    values
      (p_collab_id, null, 'system', 'payment_anomaly', v_status, v_status,
       format('%s (%s): expected %s, got %s', p_kind, p_source, p_expected, p_received));
  end if;
  raise warning 'payment anomaly: % % %', p_kind, p_source, left(coalesce(p_merchant_trade_no, ''), 64);
end;
$$;
revoke execute on function public.record_payment_anomaly(text, text, text, text, uuid, uuid, integer, integer, jsonb)
  from public, anon, authenticated, service_role;

-- 5. 建單：品牌以自己的 client 呼叫。檢查身分、狀態、金額上限、頻率；付款單編號由資料庫產生。
--    金額一律取合作案報價（呼叫者不能指定）。上限 200000 與 src/lib/payments/limits.ts 的 PAYMENT_MAX_TWD 相同。
create function public.create_payment_order(p_collab_id uuid, p_method text)
returns table (merchant_trade_no text, amount_twd integer, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_no text;
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_method is null or p_method not in ('credit', 'atm') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found or (c.brand_id <> v_uid and c.creator_id <> v_uid) then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if c.brand_id <> v_uid then
    raise exception 'not collaboration brand' using errcode = '42501';
  end if;
  if c.status <> 'awaiting_payment' then
    raise exception 'collaboration not awaiting payment' using errcode = '55000';
  end if;
  if c.amount_twd > 200000 then
    raise exception 'amount exceeds online payment limit' using errcode = '22023';
  end if;
  select count(*) into v_recent from public.payments p
   where p.collaboration_id = c.id and p.created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'too many payment orders' using errcode = '54000';
  end if;

  -- KL + 台灣日期 YYMMDD + 12 位大寫十六進位 = 20 字（綠界 MerchantTradeNo 上限 20、英數字；測試商店是共用的，要夠亂）
  v_no := 'KL' || to_char(now() at time zone 'Asia/Taipei', 'YYMMDD')
          || upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
  insert into public.payments
    (collaboration_id, provider, merchant_trade_no, amount_twd, payment_method, created_by)
  values (c.id, 'ecpay', v_no, c.amount_twd, p_method, v_uid);

  return query
  select p.merchant_trade_no, p.amount_twd, p.created_at
    from public.payments p where p.merchant_trade_no = v_no;
end;
$$;
revoke execute on function public.create_payment_order(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.create_payment_order(uuid, text) to authenticated;

-- 6. 付款成功：多了 p_env（驗證通知的金鑰屬於哪個環境）。
--    回傳 'paid'｜'already_paid'｜'paid_refund_required'｜'anomaly'。
--    找不到付款單、金額不符、付款單金額與合作案報價不符：記錄異常、回傳 'anomaly'（route 一樣回 1|OK，不讓綠界一直重送）。
--    status 為 'failed' 的付款單之後收到成功通知：照常改成 paid（綠界以最後的成功通知為準）。
drop function public.record_payment_success(text, integer, text, jsonb);
create function public.record_payment_success(
  p_merchant_trade_no text,
  p_amount_twd integer,
  p_provider_trade_no text,
  p_raw jsonb,
  p_env text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments%rowtype;
  v_status public.collab_status;
  v_price integer;
  v_raw jsonb := public.payment_raw_whitelist(p_raw);
  v_ptn text := btrim(p_provider_trade_no);
begin
  if p_amount_twd is null then
    raise exception 'amount is required' using errcode = '22023';
  end if;
  if v_ptn is null or v_ptn = '' then
    raise exception 'provider_trade_no is required' using errcode = '22023';
  end if;
  if p_env is not null and p_env not in ('stage', 'prod') then
    raise exception 'invalid env' using errcode = '22023';
  end if;

  select * into p from public.payments where merchant_trade_no = p_merchant_trade_no for update;
  if not found then
    perform public.record_payment_anomaly('notify', 'unknown_trade_no', p_merchant_trade_no, v_ptn,
                                          null, null, null, p_amount_twd, v_raw);
    return 'anomaly';
  end if;
  if p.amount_twd <> p_amount_twd then
    perform public.record_payment_anomaly('notify', 'amount_mismatch', p_merchant_trade_no, v_ptn,
                                          p.id, p.collaboration_id, p.amount_twd, p_amount_twd, v_raw);
    return 'anomaly';
  end if;
  if p.status = 'paid' then
    return 'already_paid';
  end if;

  select c.status, c.amount_twd into v_status, v_price from public.collaborations c
   where c.id = p.collaboration_id for update;
  if p.amount_twd <> v_price then
    perform public.record_payment_anomaly('notify', 'price_mismatch', p_merchant_trade_no, v_ptn,
                                          p.id, p.collaboration_id, v_price, p_amount_twd, v_raw);
    return 'anomaly';
  end if;

  update public.payments
  set status = 'paid', provider_trade_no = v_ptn, paid_at = now(), raw_notify = v_raw,
      provider_env = coalesce(p_env, provider_env)
  where id = p.id;

  if v_status = 'awaiting_payment' then
    perform set_config('kollink.recording_payment', 'on', true);
    perform public.transition_collaboration(p.collaboration_id, 'mark_paid');
    perform set_config('kollink.recording_payment', 'off', true);
    return 'paid';
  end if;

  update public.payments set refund_required = true where id = p.id;
  insert into public.audit_logs
    (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values
    (p.collaboration_id, null, 'system', 'payment_requires_refund', v_status, v_status,
     format('payment received while collaboration was %s; refund required', v_status));
  return 'paid_refund_required';
end;
$$;
revoke execute on function public.record_payment_success(text, integer, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_payment_success(text, integer, text, jsonb, text) to service_role;

-- 7. ATM 取號結果（PaymentInfoURL）：記下銀行代碼、虛擬帳號、繳費期限給品牌看。
--    回傳 'recorded'｜'unchanged'｜'ignored'（已付款或不是 ATM 單）｜'anomaly'。
create function public.record_payment_info(
  p_merchant_trade_no text,
  p_provider_trade_no text,
  p_amount_twd integer,
  p_bank_code text,
  p_v_account text,
  p_expire_date date,
  p_raw jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments%rowtype;
  v_ptn text := btrim(p_provider_trade_no);
begin
  if p_amount_twd is null or v_ptn is null or v_ptn = '' or p_expire_date is null
     or p_bank_code is null or p_bank_code !~ '^[0-9]{3}$'
     or p_v_account is null or p_v_account !~ '^[0-9]{6,16}$' then
    raise exception 'invalid payment info' using errcode = '22023';
  end if;

  select * into p from public.payments where merchant_trade_no = p_merchant_trade_no for update;
  if not found then
    perform public.record_payment_anomaly('payment_info', 'unknown_trade_no', p_merchant_trade_no, v_ptn,
                                          null, null, null, p_amount_twd, p_raw);
    return 'anomaly';
  end if;
  if p.amount_twd <> p_amount_twd then
    perform public.record_payment_anomaly('payment_info', 'amount_mismatch', p_merchant_trade_no, v_ptn,
                                          p.id, p.collaboration_id, p.amount_twd, p_amount_twd, p_raw);
    return 'anomaly';
  end if;
  if p.status <> 'pending' or p.payment_method is distinct from 'atm' then
    return 'ignored';
  end if;
  if (p.atm_bank_code, p.atm_v_account, p.atm_expire_date)
     is not distinct from (p_bank_code, p_v_account, p_expire_date) then
    return 'unchanged';
  end if;

  update public.payments
  set atm_bank_code = p_bank_code, atm_v_account = p_v_account, atm_expire_date = p_expire_date,
      payment_info_at = now(), provider_trade_no = coalesce(provider_trade_no, v_ptn)
  where id = p.id;
  return 'recorded';
end;
$$;
revoke execute on function public.record_payment_info(text, text, integer, text, text, date, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_payment_info(text, text, integer, text, text, date, jsonb) to service_role;

-- 8. 退款完成（實際退款在綠界廠商後台操作）：清除 refund_required、記錄時間與說明、寫 audit（payment_refunded）。
--    管理員（is_admin）或 service_role（Studio 的 README SQL；計畫 9 的後台）。
create function public.resolve_payment_refund(p_payment_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_actor text;
  v_note text := nullif(public.clean_text(p_note), '');
  p public.payments%rowtype;
  v_status public.collab_status;
begin
  if coalesce(auth.role(), '') = 'service_role'
     and coalesce(current_setting('role', true), '') = 'service_role' then
    v_actor := 'system';
  elsif public.is_admin() then
    v_actor := 'admin';
  else
    raise exception 'not admin' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) > 500 or public.has_bidi(v_note) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  if not p.refund_required then
    raise exception 'refund not required' using errcode = '55000';
  end if;

  update public.payments
  set refund_required = false, refunded_at = now(), refund_note = v_note
  where id = p.id;

  select c.status into v_status from public.collaborations c where c.id = p.collaboration_id;
  insert into public.audit_logs
    (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values
    (p.collaboration_id, case when v_actor = 'admin' then v_uid end, v_actor, 'payment_refunded',
     v_status, v_status, v_note);
end;
$$;
revoke execute on function public.resolve_payment_refund(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_payment_refund(uuid, text) to authenticated, service_role;

-- 9. 處理完一筆異常（例如在綠界後台確認後人工標記已付款或退款）：記錄時間與說明。
create function public.resolve_payment_anomaly(p_id bigint, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_note text := nullif(public.clean_text(p_note), '');
  a public.payment_anomalies%rowtype;
begin
  if not ((coalesce(auth.role(), '') = 'service_role'
           and coalesce(current_setting('role', true), '') = 'service_role')
          or public.is_admin()) then
    raise exception 'not admin' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) > 500 or public.has_bidi(v_note) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select * into a from public.payment_anomalies where id = p_id for update;
  if not found then
    raise exception 'anomaly not found' using errcode = 'P0002';
  end if;
  if a.resolved_at is not null then
    raise exception 'anomaly already resolved' using errcode = '55000';
  end if;
  update public.payment_anomalies set resolved_at = now(), resolved_note = v_note where id = a.id;
end;
$$;
revoke execute on function public.resolve_payment_anomaly(bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_payment_anomaly(bigint, text) to authenticated, service_role;
