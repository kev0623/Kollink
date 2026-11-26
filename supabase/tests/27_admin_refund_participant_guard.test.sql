begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- a31 品牌、a32 創作者、a33 同時是品牌的管理員（參與者）、a34 一般管理員
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a31', 'p9g-b@test.local'),
  ('00000000-0000-0000-0000-000000000a32', 'p9g-c@test.local'),
  ('00000000-0000-0000-0000-000000000a33', 'p9g-admin-brand@test.local'),
  ('00000000-0000-0000-0000-000000000a34', 'p9g-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000a31', 'brand', '九號守門品牌'),
  ('00000000-0000-0000-0000-000000000a32', 'creator', '九號守門創作者'),
  ('00000000-0000-0000-0000-000000000a33', 'brand', '九號守門管理員品牌');
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-000000000a33'), ('00000000-0000-0000-0000-000000000a34');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000a31', '九號守門品牌'),
  ('00000000-0000-0000-0000-000000000a33', '九號守門管理員品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000a32', 'admmoney_guard', 'admmoney_guard', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000ad31', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32'),
  ('00000000-0000-0000-0000-00000000ad33', '00000000-0000-0000-0000-000000000a33', '00000000-0000-0000-0000-000000000a32');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-000000000a3a', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-00000000ad31', '九號守門一般', 'x', 1000, 'cancelled'),
  ('00000000-0000-0000-0000-000000000a3b', '00000000-0000-0000-0000-000000000a33', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-00000000ad33', '九號守門管理員自己的', 'x', 1000, 'cancelled'),
  ('00000000-0000-0000-0000-000000000a3c', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-00000000ad31', '九號守門備用', 'x', 1000, 'cancelled');
insert into public.payments
  (id, collaboration_id, provider, merchant_trade_no, amount_twd, status, provider_trade_no, paid_at, provider_env, payment_method, refund_required)
values
  ('00000000-0000-0000-0000-0000000a3a01', '00000000-0000-0000-0000-000000000a3a', 'ecpay', 'KL261128P9G000001', 1000, 'paid', '2411280000000001', now(), 'prod', 'credit', true),
  ('00000000-0000-0000-0000-0000000a3b01', '00000000-0000-0000-0000-000000000a3b', 'ecpay', 'KL261128P9G000002', 1000, 'paid', '2411280000000002', now(), 'prod', 'credit', true),
  ('00000000-0000-0000-0000-0000000a3c01', '00000000-0000-0000-0000-000000000a3c', 'ecpay', 'KL261128P9G000003', 1000, 'paid', '2411280000000003', now(), 'prod', 'credit', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a33","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.resolve_payment_refund('00000000-0000-0000-0000-0000000a3b01', '已退款')$$,
  '42501', 'admin is participant', '管理員是品牌：不能處理自己合作案的退款');
select is((select refund_required from public.payments where id = '00000000-0000-0000-0000-0000000a3b01'), true,
  '參與者管理員被拒絕後款項狀態沒變');
select lives_ok(
  $$select public.resolve_payment_refund('00000000-0000-0000-0000-0000000a3a01', '已退款')$$,
  '同一位管理員處理別人的合作案：可以');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a34","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.resolve_payment_refund('00000000-0000-0000-0000-0000000a3b01', '另一位管理員已退款')$$,
  '非參與者管理員可以處理該合作案的退款');

reset role;
select is((select actor_kind from public.audit_logs
  where collaboration_id = '00000000-0000-0000-0000-000000000a3b' and action = 'payment_refunded'), 'admin',
  '審計紀錄是管理員');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$select public.resolve_payment_refund('00000000-0000-0000-0000-0000000a3c01', '備用 SQL 已退款')$$,
  'service_role 備用 SQL 可以');
reset role;
select is((select actor_kind from public.audit_logs
  where collaboration_id = '00000000-0000-0000-0000-000000000a3c' and action = 'payment_refunded'), 'system',
  'service_role 的審計紀錄是 system');

select * from finish();
rollback;
