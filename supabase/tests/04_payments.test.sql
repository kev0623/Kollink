begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values ('00000000-0000-0000-0000-00000000cc01',
        '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-00000000a001', '春季新品開箱', 'IG 貼文 1 篇', 4500,
        'awaiting_payment');
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd) values
  ('00000000-0000-0000-0000-00000000cc01', 'ecpay', 'PL0001', 4500);

insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values ('00000000-0000-0000-0000-00000000cc02',
        '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-00000000a001', '已取消的合作案', 'IG 貼文 1 篇', 4500,
        'cancelled');
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd) values
  ('00000000-0000-0000-0000-00000000cc02', 'ecpay', 'PL0002', 4500);

-- 一般使用者
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.record_payment_success('PL0001', 4500, 'T1', '{}'::jsonb)$$,
  '42501', null, '一般使用者不能呼叫付款成功函式');
select is((select count(*)::int from public.payments where merchant_trade_no = 'PL0001'), 1, '合作案參與者看得到付款紀錄');

-- 系統
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok(
  $$select public.record_payment_success('PL0001', 4000, 'T1', '{}'::jsonb)$$,
  '22023', null, '金額不符時拒絕');
select throws_ok(
  $$select public.record_payment_success('NOPE', 4500, 'T1', '{}'::jsonb)$$,
  'P0002', null, '找不到交易時拒絕');
select is(
  public.record_payment_success('PL0001', 4500, 'T1', '{"RtnCode":"1"}'::jsonb),
  'paid', '第一次通知：標記已付款');
select is(
  (select status::text from public.collaborations
     where id = '00000000-0000-0000-0000-00000000cc01'),
  'awaiting_submission', '合作案進入交稿階段');
select is(
  public.record_payment_success('PL0001', 4500, 'T1', '{"RtnCode":"1"}'::jsonb),
  'already_paid', '重複通知不會重複處理');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01' and action = 'mark_paid'),
  1, '只留下一筆 mark_paid 紀錄');
select is(
  (select status from public.payments where merchant_trade_no = 'PL0001'),
  'paid', '付款紀錄狀態為 paid');

-- 取消後才到款
select is(
  public.record_payment_success('PL0002', 4500, 'T2', '{}'::jsonb),
  'paid_refund_required', '取消後到款：不報錯，標記需退款');
select is(
  (select status from public.payments where merchant_trade_no = 'PL0002'),
  'paid', '取消後到款：付款紀錄為 paid');
select is(
  (select refund_required from public.payments where merchant_trade_no = 'PL0002'),
  true, '取消後到款：refund_required 為 true');
select is(
  (select status::text from public.collaborations
     where id = '00000000-0000-0000-0000-00000000cc02'),
  'cancelled', '取消後到款：合作案維持 cancelled');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc02'
       and action = 'payment_after_cancel' and actor_kind = 'system'),
  1, '取消後到款：留下一筆 payment_after_cancel 紀錄');
select is(
  public.record_payment_success('PL0002', 4500, 'T2', '{}'::jsonb),
  'already_paid', '取消後到款重複通知：already_paid');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc02'
       and action = 'payment_after_cancel'),
  1, '重複通知不會多寫 audit 紀錄');
select throws_ok(
  $$update public.payments set status = 'paid' where merchant_trade_no = 'PL0001'$$,
  '42501', null, 'service_role 不能直接改付款紀錄');
select throws_ok(
  $$delete from public.payments$$,
  '42501', null, 'service_role 不能刪除付款紀錄');

select * from finish();
rollback;
