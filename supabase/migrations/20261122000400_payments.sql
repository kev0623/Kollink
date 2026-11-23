-- 付款紀錄（款項託管）

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations (id),
  provider text not null check (provider in ('ecpay')),
  merchant_trade_no text not null unique check (merchant_trade_no ~ '^[A-Za-z0-9]{1,20}$'),
  amount_twd integer not null check (amount_twd > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_trade_no text,
  paid_at timestamptz,
  raw_notify jsonb,
  refund_required boolean not null default false,
  created_at timestamptz not null default now()
);
create index payments_collaboration_idx on public.payments (collaboration_id);

alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
      where c.id = collaboration_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
-- 建單由伺服器端（service role）處理，一般使用者不能寫入
revoke insert, update, delete on public.payments from anon, authenticated;
revoke truncate, trigger, references on public.payments from anon, authenticated;
-- service_role 只保留 SELECT 與 INSERT（建單）；狀態變更一律經 record_payment_success
revoke update, delete, truncate, trigger, references on public.payments from service_role;
-- INSERT 只開放建單欄位，status / paid_at / refund_required / raw_notify / provider_trade_no 不能在建單時偽造
revoke insert on public.payments from service_role;
grant insert (collaboration_id, provider, merchant_trade_no, amount_twd) on public.payments to service_role;

-- 金流通知驗簽通過後呼叫；同一筆交易重複通知只會處理一次
-- 回傳：'paid'（已付款並推進合作案）、'already_paid'（重複通知）、
--       'paid_refund_required'（付款時合作案已不在待付款，例如品牌已取消：
--       款項已收但需退款，不報錯以免綠界一直重送）
create function public.record_payment_success(
  p_merchant_trade_no text,
  p_amount_twd integer,
  p_provider_trade_no text,
  p_raw jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments%rowtype;
  v_status public.collab_status;
  v_price integer;
begin
  if p_amount_twd is null then
    raise exception 'amount is required' using errcode = '22023';
  end if;
  if p_provider_trade_no is null or p_provider_trade_no = '' then
    raise exception 'provider_trade_no is required' using errcode = '22023';
  end if;

  select * into p from public.payments where merchant_trade_no = p_merchant_trade_no for update;
  if not found then
    raise exception 'unknown merchant_trade_no %', p_merchant_trade_no using errcode = 'P0002';
  end if;
  if p.amount_twd is distinct from p_amount_twd then
    raise exception 'amount mismatch for %: expected %, got %',
      p_merchant_trade_no, p.amount_twd, p_amount_twd using errcode = '22023';
  end if;
  if p.status = 'paid' then
    return 'already_paid';
  end if;

  select status, amount_twd into v_status, v_price from public.collaborations
  where id = p.collaboration_id for update;
  if p.amount_twd is distinct from v_price then
    raise exception 'payment amount % does not match collaboration price %', p.amount_twd, v_price
      using errcode = '22023';
  end if;

  update public.payments
  set status = 'paid', provider_trade_no = p_provider_trade_no, paid_at = now(), raw_notify = p_raw
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

revoke execute on function public.record_payment_success(text, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_payment_success(text, integer, text, jsonb) to service_role;
