begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- 921 品牌、931 創作者、939 管理員；9d1 待付款合作案
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000921', 'p8f-b@test.local'),
  ('00000000-0000-0000-0000-000000000931', 'p8f-c@test.local'),
  ('00000000-0000-0000-0000-000000000939', 'p8f-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000921', 'brand', '修正品牌'),
  ('00000000-0000-0000-0000-000000000931', 'creator', '修正小美');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000939');
insert into public.brand_profiles (user_id, brand_name) values ('00000000-0000-0000-0000-000000000921', '修正品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000931', 'p8fmei', 'p8fmei', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000000009d0',
   '00000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-000000000931');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-000000000921',
   '00000000-0000-0000-0000-000000000931', '00000000-0000-0000-0000-0000000009d0', '修正待付款', 'x', 4500, 'awaiting_payment');

-- ── 單號碰撞重試：用 trigger 模擬 unique_violation（sequence 不會被子交易回滾）──
create sequence public.p8fix_seq;
create function public.p8fix_collide() returns trigger language plpgsql as $$
begin
  if nextval('public.p8fix_seq') <= 2 then
    raise unique_violation using message = 'simulated collision';
  end if;
  return new;
end;
$$;
create trigger p8fix_collide before insert on public.payments for each row execute function public.p8fix_collide();

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000921","role":"authenticated"}', true);
select lives_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009d1', 'credit')$$,
  '前兩次單號碰撞：重試後建單成功');
select is(
  (select count(*)::int from public.payments where collaboration_id = '00000000-0000-0000-0000-0000000009d1'),
  1, '只建立一張付款單');
-- 20261129000100_security_hardening.sql（L5）：authenticated 讀不到 merchant_trade_no，改以 postgres 檢查
reset role;
select is(
  (select merchant_trade_no ~ '^KL[0-9]{6}[0-9A-F]{12}$' from public.payments
    where collaboration_id = '00000000-0000-0000-0000-0000000009d1'),
  true, '單號格式不變');

reset role;
create or replace function public.p8fix_collide() returns trigger language plpgsql as $$
begin
  raise unique_violation using message = 'simulated collision';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000921","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009d1', 'atm')$$,
  '23505', null, '連續 3 次碰撞：才放棄');
reset role;
drop trigger p8fix_collide on public.payments;

-- ── audit_logs 不放管理員備註與金額細節 ──
update public.payments set status = 'paid', paid_at = now(), refund_required = true
 where collaboration_id = '00000000-0000-0000-0000-0000000009d1';
select set_config('p8f.pid', (select id::text from public.payments
  where collaboration_id = '00000000-0000-0000-0000-0000000009d1'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000939","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.resolve_payment_refund(current_setting('p8f.pid')::uuid, 'SECRET-ADMIN-NOTE 內部帳號 123')$$,
  '管理員標記退款');
reset role;
select is(
  (select refund_note from public.payments where id = current_setting('p8f.pid')::uuid),
  'SECRET-ADMIN-NOTE 內部帳號 123', '備註仍存在 payments.refund_note');

reset role;
select public.record_payment_anomaly('notify', 'amount_mismatch', 'KLP8FIXANOM', 'T-ANOM',
  current_setting('p8f.pid')::uuid, '00000000-0000-0000-0000-0000000009d1', 987654, 123456, '{}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000931","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.list_collaboration_events('00000000-0000-0000-0000-0000000009d1')
    where action in ('payment_refunded', 'payment_anomaly')),
  2, '創作者看得到兩個事件（動作本身）');
select is(
  (select count(*)::int from public.list_collaboration_events('00000000-0000-0000-0000-0000000009d1')
    where note like '%SECRET-ADMIN-NOTE%' or note like '%內部帳號%'),
  0, '創作者看不到管理員的退款備註');
select is(
  (select count(*)::int from public.list_collaboration_events('00000000-0000-0000-0000-0000000009d1')
    where note like '%987654%' or note like '%123456%' or note like '%expected%'),
  0, '創作者看不到異常的金額細節');
reset role;
select is(
  (select expected_amount_twd from public.payment_anomalies where merchant_trade_no = 'KLP8FIXANOM'),
  987654, '異常細節仍在 payment_anomalies');

select * from finish();
rollback;
