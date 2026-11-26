begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- a02 品牌、a21 創作者（會填收款帳戶）、a22 創作者（沒有收款帳戶）、a29 管理員、a28 同時是品牌的管理員
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a02', 'p9m-b@test.local'),
  ('00000000-0000-0000-0000-000000000a21', 'p9m-c1@test.local'),
  ('00000000-0000-0000-0000-000000000a22', 'p9m-c2@test.local'),
  ('00000000-0000-0000-0000-000000000a28', 'p9m-admin-brand@test.local'),
  ('00000000-0000-0000-0000-000000000a29', 'p9m-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000a02', 'brand', '九號款項品牌'),
  ('00000000-0000-0000-0000-000000000a21', 'creator', '九號款項一'),
  ('00000000-0000-0000-0000-000000000a22', 'creator', '九號款項二'),
  ('00000000-0000-0000-0000-000000000a28', 'brand', '管理員品牌');
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-000000000a28'), ('00000000-0000-0000-0000-000000000a29');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000a02', '九號款項品牌'),
  ('00000000-0000-0000-0000-000000000a28', '管理員品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000a21', 'admmoney_one', 'admmoney_one', 'approved'),
  ('00000000-0000-0000-0000-000000000a22', 'admmoney_two', 'admmoney_two', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000ad01', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21'),
  ('00000000-0000-0000-0000-00000000ad02', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a22'),
  ('00000000-0000-0000-0000-00000000ad08', '00000000-0000-0000-0000-000000000a28', '00000000-0000-0000-0000-000000000a21');
-- ac1 待付款（人工標記）、ac2 待付款＋KL 單（通知遺失）、ac3 待撥款（正式付款）、ac4 待撥款（測試付款）、
-- ac5 待撥款（創作者沒有收款帳戶）、ac6 待交稿（已付款，平台取消）、ac7 管理員自己品牌的待付款、
-- a9c8… 審核中（沒有付款，平台取消；案號搜尋）、ac9 待付款（service_role 備用 SQL）
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號線下付款', 'x', 4500, 'awaiting_payment'),
  ('00000000-0000-0000-0000-000000000ac2', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號通知遺失', 'x', 3000, 'awaiting_payment'),
  ('00000000-0000-0000-0000-000000000ac3', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號待撥款', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-000000000ac4', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號測試付款', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-000000000ac5', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a22',
   '00000000-0000-0000-0000-00000000ad02', '九號沒有帳戶', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-000000000ac6', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號爭議', 'x', 2000, 'awaiting_submission'),
  ('00000000-0000-0000-0000-000000000ac7', '00000000-0000-0000-0000-000000000a28', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad08', '管理員自己的案子', 'x', 1000, 'awaiting_payment'),
  ('a9c8a9c8-0000-0000-0000-000000000ac8', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號審核中', 'x', 1500, 'in_review'),
  ('00000000-0000-0000-0000-000000000ac9', '00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a21',
   '00000000-0000-0000-0000-00000000ad01', '九號備用', 'x', 800, 'awaiting_payment');
insert into public.payments
  (collaboration_id, provider, merchant_trade_no, amount_twd, status, provider_trade_no, paid_at, provider_env, payment_method)
values
  ('00000000-0000-0000-0000-000000000ac2', 'ecpay', 'KL261127P9LOST000001', 3000, 'pending', null, null, null, 'credit'),
  ('00000000-0000-0000-0000-000000000ac2', 'ecpay', 'MANP9FIXTURE00000001', 3000, 'pending', null, null, null, null),
  ('00000000-0000-0000-0000-000000000ac3', 'ecpay', 'KL261127P9PAID000003', 5000, 'paid', '2411270000000003', now(), 'prod', 'credit'),
  ('00000000-0000-0000-0000-000000000ac4', 'ecpay', 'KL261127P9TEST000004', 5000, 'paid', '2411270000000004', now(), 'stage', 'credit'),
  ('00000000-0000-0000-0000-000000000ac5', 'ecpay', 'MANP9FIXTURE00000005', 5000, 'paid', 'MANUAL-5', now(), null, null),
  ('00000000-0000-0000-0000-000000000ac6', 'ecpay', 'KL261127P9DISP000006', 2000, 'paid', '2411270000000006', now(), 'prod', 'atm');

-- ===== 1. 收款帳戶 =====
select ok(not has_function_privilege('anon', 'public.set_my_payout_account(text, text, text, text)', 'execute'),
  'anon 不能設定收款帳戶');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a21","role":"authenticated"}', true);
select lives_ok(
  $$select public.set_my_payout_account(' 812 ', '', '1234-5678 5678', ' 九號 一 ')$$,
  '創作者設定收款帳戶（空白與 - 會去掉）');
select is(
  (select bank_code || ',' || coalesce(branch_code, 'null') || ',' || account_last4 || ',' || account_name
     from public.creator_payout_accounts where user_id = '00000000-0000-0000-0000-000000000a21'),
  '812,null,5678,九號 一', '本人看得到銀行代碼、末四碼、戶名');
select throws_ok(
  $$select account_number from public.creator_payout_accounts$$,
  '42501', null, '本人也不能直接讀完整帳號');
select throws_ok(
  $$select public.set_my_payout_account('81', null, '123456785678', 'x')$$,
  '22023', 'invalid bank_code', '銀行代碼要 3 碼');
select throws_ok(
  $$select public.set_my_payout_account('812', '12', '123456785678', 'x')$$,
  '22023', 'invalid branch_code', '分行代碼要 4 碼');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456', 'x')$$,
  '22023', 'invalid account_number', '帳號 7–16 碼');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', '   ')$$,
  '22023', 'invalid account_name', '戶名必填');
select throws_ok(
  $$insert into public.creator_payout_accounts (user_id, bank_code, account_number, account_name)
    values ('00000000-0000-0000-0000-000000000a22', '812', '12345678', 'x')$$,
  '42501', null, '不能直接寫入資料表');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a02","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_payout_accounts), 0, '品牌看不到任何收款帳戶');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', 'x')$$,
  '42501', 'not a creator', '品牌不能設定收款帳戶');
select throws_ok(
  $$select admin_note from public.payments$$,
  '42501', null, '參與者讀不到 payments.admin_note');
select throws_ok(
  $$select public.admin_record_offline_payment('00000000-0000-0000-0000-000000000ac1', '品牌匯款')$$,
  '42501', 'not admin', '品牌不能人工標記已付款');
select throws_ok(
  $$select * from public.admin_list_collaborations('active', null, 50, 0)$$,
  '42501', 'not admin', '品牌不能看全部合作案');
select throws_ok(
  $$select * from public.admin_get_payout_account('00000000-0000-0000-0000-000000000ac3')$$,
  '42501', 'not admin', '品牌不能看收款帳戶');
select throws_ok(
  $$select public.admin_cancel_collaboration('00000000-0000-0000-0000-000000000ac6', '爭議')$$,
  '42501', 'not admin', '品牌不能平台取消');

-- ===== 2. 人工標記已付款（線下） =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a29","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.admin_record_offline_payment('00000000-0000-0000-0000-000000000ac1', ' ')$$,
  '22023', 'invalid note', '說明必填');
select is(
  public.admin_record_offline_payment('00000000-0000-0000-0000-000000000ac1', '品牌 11/27 匯款，末五碼 12345'),
  'paid', '管理員標記線下付款');
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-000000000ac1'),
  'awaiting_submission', '進入待交稿');
select is(
  (select left(merchant_trade_no, 3) || ',' || admin_note || ',' || coalesce(provider_env, 'null')
     from public.admin_list_payments('all', 50, 0, '00000000-0000-0000-0000-000000000ac1')),
  'MAN,品牌 11/27 匯款，末五碼 12345,null', 'MAN 付款單記下說明（管理員從列表讀得到 admin_note）');
-- 20261129000100_security_hardening.sql（L3）：authenticated 讀不到 audit_logs.actor_id，改以 postgres 檢查寫入的內容
reset role;
select is(
  (select actor_kind || ',' || actor_id::text from public.audit_logs
    where collaboration_id = '00000000-0000-0000-0000-000000000ac1' and action = 'mark_paid'),
  'admin,00000000-0000-0000-0000-000000000a29', 'mark_paid 的 actor 是管理員');
set local role authenticated;
select throws_ok(
  $$select public.admin_record_offline_payment('00000000-0000-0000-0000-000000000ac1', '重複')$$,
  '55000', 'collaboration not awaiting payment', '已付款不能再標記');
select throws_ok(
  $$select public.admin_record_offline_payment('00000000-0000-0000-0000-0000000000ff', 'x')$$,
  'P0002', 'collaboration not found', '找不到合作案');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-000000000ac9', 'mark_paid')$$,
  '22023', null, '管理員不能直接 mark_paid');

-- ===== 3. 綠界已扣款、通知遺失（KL 單） =====
select throws_ok(
  $$select public.admin_record_lost_payment('KL261127P9LOST000001', '2411270000000001', 3000, 'test', '已確認')$$,
  '22023', 'invalid env', '環境只能是 stage／prod');
select throws_ok(
  $$select public.admin_record_lost_payment('KL261127P9LOST000001', ' ', 3000, 'prod', '已確認')$$,
  '22023', 'invalid provider_trade_no', '綠界交易編號必填');
select throws_ok(
  $$select public.admin_record_lost_payment('KL000000000000NOPE00', '2411270000000001', 3000, 'prod', '已確認')$$,
  'P0002', 'payment not found', '找不到付款單');
select throws_ok(
  $$select public.admin_record_lost_payment('MANP9FIXTURE00000001', '2411270000000001', 3000, 'prod', '已確認')$$,
  '22023', 'not an online payment', 'MAN 單不能用這條路');
select is(
  public.admin_record_lost_payment('KL261127P9LOST000001', '2411270000000001', 3001, 'stage', '金額打錯'),
  'anomaly', '金額不符：記錄為付款異常');
select is(
  public.admin_record_lost_payment('KL261127P9LOST000001', '2411270000000001', 3000, 'stage', '綠界後台確認 11/27 成功'),
  'paid', '金額相符：標記已付款');
select is(
  (select status || ',' || provider_env || ',' || provider_trade_no || ',' || admin_note
     from public.admin_list_payments('paid', 50, 0, '00000000-0000-0000-0000-000000000ac2')),
  'paid,stage,2411270000000001,綠界後台確認 11/27 成功', '記下環境、交易編號、說明');

-- 管理員是品牌的合作案：以參與者身分，不能用管理員權限
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a28","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.admin_record_offline_payment('00000000-0000-0000-0000-000000000ac7', '自己付')$$,
  '42501', 'admin is participant', '管理員不能標記自己品牌的合作案');

-- ===== 4. 撥款 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a29","role":"authenticated","aal":"aal2"}', true);
select is(
  (select account_number from public.admin_get_payout_account('00000000-0000-0000-0000-000000000ac3')),
  '123456785678', '撥款畫面看得到完整帳號');
select is(
  (select account_number from public.admin_get_payout_account('00000000-0000-0000-0000-000000000ac3')),
  '123456785678', '再看一次');
select is(
  (select count(*)::int from public.audit_logs
    where action = 'payout_account_viewed' and subject_id = '00000000-0000-0000-0000-000000000a21'),
  1, '10 分鐘內只記一筆查看紀錄');
select is(
  (select count(*)::int from public.admin_get_payout_account('00000000-0000-0000-0000-000000000ac1')),
  0, '不是待撥款的合作案不回傳帳號');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-000000000ac3', 'payout')$$,
  '22023', null, '不能直接 payout（要經由 admin_mark_payout）');
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-000000000ac4', '已轉帳', '5678')$$,
  '55000', 'test payment cannot be paid out', '測試付款不能撥款');
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-000000000ac5', '已轉帳', '5678')$$,
  '55000', 'payout account missing', '創作者沒有收款帳戶');
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-000000000ac3', '', '5678')$$,
  '22023', 'invalid note', '轉帳說明必填');
select lives_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-000000000ac3', '11/28 國泰網銀轉帳，交易序號 778899', '5678')$$,
  '撥款');
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-000000000ac3'),
  'completed', '結案');
select is(
  (select account_last4 || ',' || amount_twd || ',' || actor_kind || ',' || transfer_note
     from public.collaboration_payouts where collaboration_id = '00000000-0000-0000-0000-000000000ac3'),
  '5678,5000,admin,11/28 國泰網銀轉帳，交易序號 778899', '撥款紀錄留下帳戶末四碼與轉帳說明');
select ok(
  (select note is null and actor_kind = 'admin' from public.audit_logs
    where collaboration_id = '00000000-0000-0000-0000-000000000ac3' and action = 'payout'),
  'payout 的 audit 不放轉帳說明（參與者看得到）');
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-000000000ac3', '再一次', '5678')$$,
  '55000', 'collaboration not awaiting payout', '不能重複撥款');

-- ===== 5. 平台取消 =====
select throws_ok(
  $$select public.admin_cancel_collaboration('00000000-0000-0000-0000-000000000ac6', '')$$,
  '22023', 'invalid reason', '原因必填');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-000000000ac6', 'admin_cancel', '直接取消')$$,
  '22023', null, '不能直接 admin_cancel（要經由 admin_cancel_collaboration）');
select is(
  public.admin_cancel_collaboration('00000000-0000-0000-0000-000000000ac6', '創作者無法交稿，雙方同意取消'),
  1, '已付款的合作案取消：標記 1 筆需退款');
select ok(
  (select c.status = 'cancelled' and p.refund_required
     from public.collaborations c join public.payments p on p.collaboration_id = c.id
    where c.id = '00000000-0000-0000-0000-000000000ac6'),
  '狀態取消、款項需退款');
select is(
  public.admin_cancel_collaboration('a9c8a9c8-0000-0000-0000-000000000ac8', '品牌要求取消'),
  0, '沒有付款的合作案取消：不需退款');
select throws_ok(
  $$select public.admin_cancel_collaboration('00000000-0000-0000-0000-000000000ac3', '太晚了')$$,
  '55000', 'collaboration already closed', '已結案不能取消');

-- ===== 6. 列表與總覽 =====
select is(
  (select count(*)::int from public.admin_list_collaborations('all', 'a9c8a9c8', 50, 0)),
  1, '用案號找合作案');
select is(
  (select count(*)::int from public.admin_list_collaborations('awaiting_payout', '九號', 50, 0)),
  2, '依狀態與案名篩選');
select ok(
  (select test_paid from public.admin_list_collaborations('all', '九號測試付款', 50, 0)),
  '列表標出測試付款');
select throws_ok(
  $$select * from public.admin_list_collaborations('bogus', null, 50, 0)$$,
  '22023', 'invalid status', '不認得的狀態');
select is(
  (select count(*)::int from public.admin_list_payments('refund', 50, 0, '00000000-0000-0000-0000-000000000ac6')),
  1, '需退款列表');
select is(
  (select coalesce(bank_code, 'null') || ',' || test_paid from public.admin_list_payouts(100, 0)
    where id = '00000000-0000-0000-0000-000000000ac5'),
  'null,false', '待撥款列表標出沒有收款帳戶');
select ok((select awaiting_payout >= 2 from public.admin_overview()), '總覽數字');
reset role;

-- ===== 7. service_role（README 備用 SQL） =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.admin_record_offline_payment('00000000-0000-0000-0000-000000000ac9', '備用 SQL'),
  'paid', 'service_role 也可以人工標記已付款');
reset role;
select is(
  (select actor_kind || ',' || coalesce(actor_id::text, 'null') from public.audit_logs
    where collaboration_id = '00000000-0000-0000-0000-000000000ac9' and action = 'mark_paid'),
  'system,null', 'service_role 的 actor 是 system');

select * from finish();
rollback;
