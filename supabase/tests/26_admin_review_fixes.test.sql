begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- 計畫 9 資料庫審查修正（20261128000300_admin_review_fixes.sql）
-- a31 品牌、a32 創作者（有收款帳戶）、a34 管理員兼創作者、a35 管理員、a36 管理員兼品牌
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a31', 'p9f-b@test.local'),
  ('00000000-0000-0000-0000-000000000a32', 'p9f-c@test.local'),
  ('00000000-0000-0000-0000-000000000a34', 'p9f-admin-creator@test.local'),
  ('00000000-0000-0000-0000-000000000a35', 'p9f-admin@test.local'),
  ('00000000-0000-0000-0000-000000000a36', 'p9f-admin-brand@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000a31', 'brand', '修正品牌'),
  ('00000000-0000-0000-0000-000000000a32', 'creator', '修正創作者'),
  ('00000000-0000-0000-0000-000000000a34', 'creator', '管理員創作者'),
  ('00000000-0000-0000-0000-000000000a36', 'brand', '管理員品牌');
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-000000000a34'), ('00000000-0000-0000-0000-000000000a35'),
  ('00000000-0000-0000-0000-000000000a36');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000a31', '修正品牌'),
  ('00000000-0000-0000-0000-000000000a36', '管理員品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000a32', 'admfix_one', 'admfix_one', 'approved'),
  ('00000000-0000-0000-0000-000000000a34', 'admfix_self', 'admfix_self', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000000af001', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32'),
  ('00000000-0000-0000-0000-0000000af002', '00000000-0000-0000-0000-000000000a36', '00000000-0000-0000-0000-000000000a32'),
  ('00000000-0000-0000-0000-0000000af003', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a34');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-0000000af0b1', '00000000-0000-0000-0000-0000000af003',
   '00000000-0000-0000-0000-000000000a34', '加我電話 0912345678');
-- f1 待撥款（正式付款）、f2 待撥款（正式付款＋另一筆待退款）、f3 管理員自己是品牌的待撥款、f4 待付款（KL 單，通知遺失）
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-0000000af0c1', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-0000000af001', '修正待撥款', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-0000000af0c2', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-0000000af001', '修正待退款', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-0000000af0c3', '00000000-0000-0000-0000-000000000a36', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-0000000af002', '修正管理員自己的案', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-0000000af0c4', '00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000a32',
   '00000000-0000-0000-0000-0000000af001', '修正通知遺失', 'x', 3000, 'awaiting_payment');
insert into public.payments
  (collaboration_id, provider, merchant_trade_no, amount_twd, status, provider_trade_no, paid_at, provider_env, payment_method, refund_required)
values
  ('00000000-0000-0000-0000-0000000af0c1', 'ecpay', 'KL2611280A31PAID0001', 5000, 'paid', '2411280000000001', now(), 'prod', 'credit', false),
  ('00000000-0000-0000-0000-0000000af0c2', 'ecpay', 'KL2611280A32PAID0002', 5000, 'paid', '2411280000000002', now(), 'prod', 'credit', false),
  ('00000000-0000-0000-0000-0000000af0c2', 'ecpay', 'KL2611280A32RFND0002', 5000, 'paid', '2411280000000012', now(), 'prod', 'credit', true),
  ('00000000-0000-0000-0000-0000000af0c3', 'ecpay', 'KL2611280A33PAID0003', 5000, 'paid', '2411280000000003', now(), 'prod', 'credit', false),
  ('00000000-0000-0000-0000-0000000af0c4', 'ecpay', 'KL2611280A34LOST0004', 3000, 'pending', null, null, null, 'credit', false);

-- ===== 1. 戶名驗證與帳戶 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a32","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', repeat('字', 41))$$,
  '22023', 'invalid account_name', '戶名超過 40 字');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', E'王‮小明')$$,
  '22023', 'invalid account_name', '戶名含雙向控制字元');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', E'王\n小明')$$,
  '22023', 'invalid account_name', '戶名中間有換行');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', E'王\u0085小明')$$,
  '22023', 'invalid account_name', '戶名含 C1 控制字元');
select throws_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', E'王\u0007小明')$$,
  '22023', 'invalid account_name', '戶名含 C0 控制字元');
select lives_ok(
  $$select public.set_my_payout_account('812', null, '123456785678', E' 王小明\n')$$,
  '前後的換行會被 clean_text 去掉，正常戶名可儲存');

-- ===== 2. 自己不能處理自己 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a34","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a34', 'suspend', '自己停權自己')$$,
  '42501', 'admin is subject', '管理員不能改自己的創作者狀態');
select is(
  (select status from public.creator_profiles where user_id = '00000000-0000-0000-0000-000000000a34'),
  'approved', '狀態沒有被改');
select throws_ok(
  $$select public.mark_message_reviewed('00000000-0000-0000-0000-0000000af0b1')$$,
  '42501', 'admin is subject', '管理員不能標記自己發的訊息已檢視');
select lives_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a32', 'suspend', '其他管理員處理別人沒問題')$$,
  '管理員可以處理別人');
select lives_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a32', 'unsuspend')$$,
  '復原');

-- ===== 3. 補登：鎖順序、admin_note、異常來源 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a35","role":"authenticated"}', true);
select ok(
  position('for update' in pg_get_functiondef('public.admin_record_lost_payment(text, text, integer, text, text)'::regprocedure))
    > 0
  and position('for update' in pg_get_functiondef('public.admin_record_lost_payment(text, text, integer, text, text)'::regprocedure))
    < position('admin_lock_collab' in pg_get_functiondef('public.admin_record_lost_payment(text, text, integer, text, text)'::regprocedure)),
  '通知遺失補登：先鎖付款單（for update）再鎖合作案（admin_lock_collab）');
select is(
  public.admin_record_lost_payment('KL2611280A34LOST0004', '2411280000000004', 3001, 'prod', '金額打錯的說明'),
  'anomaly', '金額不符：回 anomaly');
select is(
  (select x.admin_note from public.admin_list_payments('all', 50, 0, '00000000-0000-0000-0000-0000000af0c4') x
    where x.merchant_trade_no = 'KL2611280A34LOST0004'),
  null, '異常時不寫 admin_note');
select is(
  (select source from public.payment_anomalies where merchant_trade_no = 'KL2611280A34LOST0004'),
  'admin', '管理員補登觸發的異常 source = admin');
select is(
  public.admin_record_lost_payment('KL2611280A34LOST0004', '2411280000000004', 3001, 'prod', '再打一次'),
  'anomaly', '再補登同樣的錯誤');
select is(
  (select count(*)::int from public.payment_anomalies where merchant_trade_no = 'KL2611280A34LOST0004'),
  1, '去重仍然有效：只有一筆異常');
select is(
  public.admin_record_lost_payment('KL2611280A34LOST0004', '2411280000000004', 3000, 'prod', '綠界後台確認成功'),
  'paid', '金額相符：標記已付款');
select is(
  (select x.admin_note from public.admin_list_payments('all', 50, 0, '00000000-0000-0000-0000-0000000af0c4') x
    where x.merchant_trade_no = 'KL2611280A34LOST0004'),
  '綠界後台確認成功', 'paid 才寫 admin_note');
select is(
  public.admin_record_lost_payment('KL2611280A34LOST0004', '2411280000000004', 3000, 'prod', '不該覆蓋'),
  'already_paid', '已付款：already_paid');
select is(
  (select x.admin_note from public.admin_list_payments('all', 50, 0, '00000000-0000-0000-0000-0000000af0c4') x
    where x.merchant_trade_no = 'KL2611280A34LOST0004'),
  '綠界後台確認成功', 'already_paid 不覆蓋 admin_note');

-- ===== 4. 撥款 =====
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-0000000af0c2', '已轉帳', '5678')$$,
  '55000', 'refund pending', '有待退款的款項不能撥款');
-- 管理員看到末四碼 5678 之後，創作者改了帳戶
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a32","role":"authenticated"}', true);
select lives_ok(
  $$select public.set_my_payout_account('822', null, '9876549999', '王小明')$$,
  '創作者改帳戶');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a35","role":"authenticated"}', true);
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-0000000af0c1', '已轉帳', '5678')$$,
  '55000', 'payout account changed', '帳戶已變更：撥款被拒絕');
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000af0c1'),
  'awaiting_payout', '仍是待撥款');
select lives_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-0000000af0c1', '已轉帳', '9999')$$,
  '末四碼相符才撥款');

-- ===== 5. 權限 =====
select throws_ok(
  $$select account_number from public.creator_payout_accounts$$,
  '42501', null, '管理員不能直接 select account_number');
select is(
  (select count(*)::int from public.collaboration_payouts), 1, '管理員看得到撥款紀錄');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a32","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.collaboration_payouts), 0, '創作者（參與者）看不到撥款紀錄');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a31","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.collaboration_payouts), 0, '品牌（參與者）看不到撥款紀錄');

-- ===== 6. 管理員是參與者 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a36","role":"authenticated"}', true);
select throws_ok(
  $$select public.admin_mark_payout('00000000-0000-0000-0000-0000000af0c3', '已轉帳', '9999')$$,
  '42501', 'admin is participant', '管理員是品牌：不能撥款');
select throws_ok(
  $$select public.admin_cancel_collaboration('00000000-0000-0000-0000-0000000af0c3', '想取消')$$,
  '42501', 'admin is participant', '管理員是品牌：不能平台取消');
select throws_ok(
  $$select * from public.admin_get_payout_account('00000000-0000-0000-0000-0000000af0c3')$$,
  '42501', 'admin is participant', '管理員是品牌：不能看完整帳號');

-- ===== 7. service_role（system）不受自己處理自己的限制，異常 source 維持 notify =====
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a34', 'suspend', '系統備用')$$,
  'system 不受 admin is subject 限制');
select is(
  public.record_payment_success('KL000000000000NOPE00', 100, '2411280000000099', '{}'::jsonb),
  'anomaly', '通知找不到付款單');
select is(
  (select source from public.payment_anomalies where merchant_trade_no = 'KL000000000000NOPE00'),
  'notify', '綠界通知的異常 source 仍是 notify');
reset role;

select * from finish();
rollback;
