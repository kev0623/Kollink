-- 計畫 8 審查修正：單號碰撞重試；audit_logs（參與者可見）不放管理員備註與金額細節。
-- 函式內容與 20261127000100_payment_orders.sql 相同，只改上述處；權限重新宣告。

create or replace function public.record_payment_anomaly(
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
       null);  -- 金額等內部細節只留在 payment_anomalies（僅管理員可讀）；audit_logs 參與者看得到，不放備註
  end if;
  raise warning 'payment anomaly: % % %', p_kind, p_source, left(coalesce(p_merchant_trade_no, ''), 64);
end;
$$;
revoke execute on function public.record_payment_anomaly(text, text, text, text, uuid, uuid, integer, integer, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.create_payment_order(p_collab_id uuid, p_method text)
returns table (merchant_trade_no text, amount_twd integer, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_no text;
  v_recent integer;
  v_attempt integer;
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
  -- 單號碰撞（unique_violation）時重新產生，最多 3 次
  for v_attempt in 1..3 loop
    v_no := 'KL' || to_char(now() at time zone 'Asia/Taipei', 'YYMMDD')
            || upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
    begin
      insert into public.payments
        (collaboration_id, provider, merchant_trade_no, amount_twd, payment_method, created_by)
      values (c.id, 'ecpay', v_no, c.amount_twd, p_method, v_uid);
      exit;
    exception when unique_violation then
      if v_attempt = 3 then raise; end if;
    end;
  end loop;

  return query
  select p.merchant_trade_no, p.amount_twd, p.created_at
    from public.payments p where p.merchant_trade_no = v_no;
end;
$$;
revoke execute on function public.create_payment_order(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.create_payment_order(uuid, text) to authenticated;

create or replace function public.resolve_payment_refund(p_payment_id uuid, p_note text) returns void
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
     v_status, v_status, null);  -- 管理員備註只存 payments.refund_note；audit_logs 參與者看得到，不放備註
end;
$$;
revoke execute on function public.resolve_payment_refund(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_payment_refund(uuid, text) to authenticated, service_role;
