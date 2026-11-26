begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

-- 901 品牌、902 第三方品牌、911 創作者、919 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000901', 'p8-b1@test.local'),
  ('00000000-0000-0000-0000-000000000902', 'p8-b2@test.local'),
  ('00000000-0000-0000-0000-000000000911', 'p8-c1@test.local'),
  ('00000000-0000-0000-0000-000000000919', 'p8-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000901', 'brand', '八號品牌'),
  ('00000000-0000-0000-0000-000000000902', 'brand', '路人品牌'),
  ('00000000-0000-0000-0000-000000000911', 'creator', '八號小美');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000919');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000901', '八號品牌'),
  ('00000000-0000-0000-0000-000000000902', '路人品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000911', 'p8mei', 'p8mei', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-000000009a01',
   '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000911');
-- 9c1 待付款（主要）、9c2 邀約中、9c3 超過線上付款上限、9c4 已取消、9c5 頻率限制與 failed → paid
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000009a01', '八號待付款', 'x', 4500, 'awaiting_payment'),
  ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000009a01', '八號邀約中', 'x', 4500, 'invited'),
  ('00000000-0000-0000-0000-0000000009c3', '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000009a01', '八號超過上限', 'x', 200001, 'awaiting_payment'),
  ('00000000-0000-0000-0000-0000000009c4', '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000009a01', '八號已取消', 'x', 3000, 'cancelled'),
  ('00000000-0000-0000-0000-0000000009c5', '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000009a01', '八號頻率', 'x', 2000, 'awaiting_payment');

-- ── 建單 ──
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c1', 'credit')$$,
  '42501', null, 'anon 不能建單');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000911","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c1', 'credit')$$,
  '42501', 'not collaboration brand', '創作者不能建單');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000902","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c1', 'credit')$$,
  'P0002', 'collaboration not found', '第三方品牌看不到這個合作案');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000901","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c1', 'cvs')$$,
  '22023', 'invalid payment method', '只接受 credit 與 atm');
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c2', 'credit')$$,
  '55000', 'collaboration not awaiting payment', '邀約中不能建單');
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c3', 'credit')$$,
  '22023', 'amount exceeds online payment limit', '超過線上付款上限');
select is(
  (select amount_twd from public.create_payment_order('00000000-0000-0000-0000-0000000009c1', 'credit')),
  4500, '信用卡單：金額取合作案報價');
select ok(
  (select merchant_trade_no ~ '^KL[0-9]{6}[0-9A-F]{12}$'
     from public.create_payment_order('00000000-0000-0000-0000-0000000009c1', 'atm')),
  'ATM 單：付款單編號 KL + 日期 + 12 位，共 20 字');
select is(
  (select count(*)::int from public.payments
    where collaboration_id = '00000000-0000-0000-0000-0000000009c1' and status = 'pending'),
  2, '品牌看得到自己的兩張待付款單');
select throws_ok(
  $$select raw_notify from public.payments limit 1$$,
  '42501', null, '品牌讀不到 raw_notify');
select throws_ok(
  $$insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd)
    values ('00000000-0000-0000-0000-0000000009c1', 'ecpay', 'KLFAKE', 4500)$$,
  '42501', null, '品牌不能直接新增付款單');
select is(
  -- 參數要依 g 變化，否則 lateral 只會執行一次
  (select count(*)::int from generate_series(1, 10) g,
          lateral public.create_payment_order('00000000-0000-0000-0000-0000000009c5',
                                              case when g > 0 then 'credit' end)),
  10, '一小時內可建 10 張單');
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000009c5', 'credit')$$,
  '54000', 'too many payment orders', '第 11 張被頻率限制擋下');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000911","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.payments where collaboration_id = '00000000-0000-0000-0000-0000000009c1'),
  2, '創作者看得到合作案的付款單');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000902","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.payments where collaboration_id = '00000000-0000-0000-0000-0000000009c1'),
  0, '第三方看不到');

-- 記下兩張單的編號（擁有者身分）
reset role;
select set_config('p8.atm', (select merchant_trade_no from public.payments
  where collaboration_id = '00000000-0000-0000-0000-0000000009c1' and payment_method = 'atm'), true);
select set_config('p8.credit', (select merchant_trade_no from public.payments
  where collaboration_id = '00000000-0000-0000-0000-0000000009c1' and payment_method = 'credit'), true);
select is(
  (select count(*)::int from public.payments
    where collaboration_id = '00000000-0000-0000-0000-0000000009c1'
      and created_by = '00000000-0000-0000-0000-000000000901'),
  2, 'created_by 是品牌');

-- ── ATM 取號 ──
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.record_payment_info(current_setting('p8.atm'), '2611271200001', 4500, '822', '9103522850', '2026-11-30',
                             '{"RtnCode":"2"}'::jsonb),
  'recorded', '取號結果：記錄');
select is(
  public.record_payment_info(current_setting('p8.atm'), '2611271200001', 4500, '822', '9103522850', '2026-11-30',
                             '{"RtnCode":"2"}'::jsonb),
  'unchanged', '重送：不重複更新');
select is(
  public.record_payment_info(current_setting('p8.credit'), '2611271200002', 4500, '822', '9103522851', '2026-11-30',
                             '{}'::jsonb),
  'ignored', '信用卡單的取號通知：忽略');
select throws_ok(
  format($$select public.record_payment_info(%L, 'T', 4500, '82', '9103522850', '2026-11-30', '{}'::jsonb)$$,
         current_setting('p8.atm')),
  '22023', 'invalid payment info', '銀行代碼格式不對');
select is(
  public.record_payment_info('KLNOPE', 'T9', 4500, '822', '9103522850', '2026-11-30', '{}'::jsonb),
  'anomaly', '找不到付款單：記錄異常');
select is(
  (select count(*)::int from public.payment_anomalies
    where merchant_trade_no = 'KLNOPE' and kind = 'unknown_trade_no' and source = 'payment_info'
      and collaboration_id is null),
  1, '異常紀錄：unknown_trade_no');
select is(
  public.record_payment_info(current_setting('p8.atm'), '2611271200001', 1, '822', '9103522850', '2026-11-30',
                             '{}'::jsonb),
  'anomaly', '取號金額不符：記錄異常');
select is(
  (select count(*)::int from public.audit_logs
    where collaboration_id = '00000000-0000-0000-0000-0000000009c1' and action = 'payment_anomaly'),
  1, '金額不符：寫一筆 payment_anomaly');
select is(
  (select atm_bank_code || '/' || atm_v_account || '/' || atm_expire_date::text from public.payments
    where merchant_trade_no = current_setting('p8.atm')),
  '822/9103522850/2026-11-30', 'ATM 資訊已存');

-- ── 付款成功 ──
select is(
  public.record_payment_success(current_setting('p8.credit'), 4501, 'T-C1', '{}'::jsonb, 'stage'),
  'anomaly', '付款金額不符：不報錯，回傳 anomaly');
select is(
  public.record_payment_success(current_setting('p8.credit'), 4501, 'T-C1', '{}'::jsonb, 'stage')
    || ':' || (select count(*) from public.payment_anomalies where merchant_trade_no = current_setting('p8.credit')),
  'anomaly:1', '重送：異常只記一次');
select is(
  public.record_payment_success(current_setting('p8.atm'), 4500, ' 2611271200001 ',
    '{"RtnCode":"1","TradeNo":"2611271200001","card6no":"431195","card4no":"2222","ATMAccNo":"12345"}'::jsonb, 'stage'),
  'paid', 'ATM 單付款成功');
select ok(
  (select raw_notify ? 'TradeNo' and not (raw_notify ? 'card6no') and not (raw_notify ? 'card4no')
          and not (raw_notify ? 'ATMAccNo')
     from public.payments where merchant_trade_no = current_setting('p8.atm')),
  'raw_notify 只留白名單欄位');
select is(
  (select provider_env || '/' || provider_trade_no from public.payments where merchant_trade_no = current_setting('p8.atm')),
  'stage/2611271200001', '記錄環境、交易編號去掉前後空白');
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000009c1'),
  'awaiting_submission', '合作案進入交稿');
select is(
  public.record_payment_success(current_setting('p8.credit'), 4500, 'T-C1', '{}'::jsonb, 'stage'),
  'paid_refund_required', '同一案第二張單也付了：需退款');
select throws_ok(
  format($$select public.record_payment_success(%L, 4500, 'T', '{}'::jsonb, 'test')$$, current_setting('p8.credit')),
  '22023', 'invalid env', '環境只接受 stage／prod');
select throws_ok(
  $$select public.record_payment_success('KLX', 4500, '   ', '{}'::jsonb)$$,
  '22023', 'provider_trade_no is required', '交易編號只有空白：拒絕');

-- failed → paid
reset role;
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd, status) values
  ('00000000-0000-0000-0000-0000000009c5', 'ecpay', 'KLFAILED01', 2000, 'failed');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.record_payment_success('KLFAILED01', 2000, 'T-F1', '{}'::jsonb),
  'paid', 'failed 的單收到成功通知：改成 paid');
select is(
  (select status || '/' || coalesce(provider_env, 'null') from public.payments where merchant_trade_no = 'KLFAILED01'),
  'paid/null', '沒帶環境（本機、人工）時 provider_env 是 null');

-- ── 退款標記 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000901","role":"authenticated"}', true);
select throws_ok(
  format($$select public.resolve_payment_refund((select id from public.payments where merchant_trade_no = %L), '已退款')$$,
         current_setting('p8.credit')),
  '42501', 'not admin', '品牌不能標記退款');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('p8.credit_id', (select id::text from public.payments where merchant_trade_no = current_setting('p8.credit')), true);
select throws_ok(
  $$select public.resolve_payment_refund(current_setting('p8.credit_id')::uuid, '  ')$$,
  '22023', 'invalid note', '說明必填');
select lives_ok(
  $$select public.resolve_payment_refund(current_setting('p8.credit_id')::uuid, '綠界後台已退款 2026/11/27')$$,
  'service_role 可以標記退款');
select is(
  (select (not refund_required) and refunded_at is not null from public.payments where id = current_setting('p8.credit_id')::uuid),
  true, '清除 refund_required、記錄退款時間');
select throws_ok(
  $$select public.resolve_payment_refund(current_setting('p8.credit_id')::uuid, '再一次')$$,
  '55000', 'refund not required', '已退款不能再標記');
select is(
  (select count(*)::int from public.audit_logs
    where collaboration_id = '00000000-0000-0000-0000-0000000009c1' and action = 'payment_refunded' and actor_kind = 'system'),
  1, '寫一筆 payment_refunded');

reset role;
insert into public.payments (collaboration_id, provider, merchant_trade_no, amount_twd) values
  ('00000000-0000-0000-0000-0000000009c4', 'ecpay', 'KLCANCEL01', 3000);
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.record_payment_success('KLCANCEL01', 3000, 'T-X1', '{}'::jsonb, 'prod'),
  'paid_refund_required', '取消後到款：需退款');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000919","role":"authenticated"}', true);
select lives_ok(
  $$select public.resolve_payment_refund((select id from public.payments where merchant_trade_no = 'KLCANCEL01'), '已退款')$$,
  '管理員可以標記退款');
select is(
  (select actor_kind || '/' || actor_id::text from public.audit_logs
    where collaboration_id = '00000000-0000-0000-0000-0000000009c4' and action = 'payment_refunded'),
  'admin/00000000-0000-0000-0000-000000000919', '管理員的退款紀錄有 actor_id');

-- ── 異常列表與處理 ──
select is(
  (select count(*)::int from public.payment_anomalies where merchant_trade_no in ('KLNOPE', current_setting('p8.atm'), current_setting('p8.credit'))),
  3, '管理員看得到異常');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000901","role":"authenticated"}', true);
select is((select count(*)::int from public.payment_anomalies), 0, '品牌看不到異常');
select throws_ok(
  $$select public.resolve_payment_anomaly((select min(id) from public.payment_anomalies), '處理')$$,
  '42501', 'not admin', '品牌不能處理異常');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('p8.anomaly', (select id::text from public.payment_anomalies where merchant_trade_no = 'KLNOPE'), true);
select lives_ok(
  $$select public.resolve_payment_anomaly(current_setting('p8.anomaly')::bigint, '不是本平台的訂單')$$,
  'service_role 可以處理異常');
select throws_ok(
  $$select public.resolve_payment_anomaly(current_setting('p8.anomaly')::bigint, '再一次')$$,
  '55000', 'anomaly already resolved', '已處理不能再處理');
select throws_ok(
  $$select public.payment_raw_whitelist('{}'::jsonb)$$,
  '42501', null, '白名單 helper 不授權給 API 角色');
select throws_ok(
  $$select public.record_payment_anomaly('notify', 'unknown_trade_no', 'X', 'Y', null, null, null, 1, '{}'::jsonb)$$,
  '42501', null, '異常 helper 不授權給 API 角色');

reset role;
select throws_ok(
  format($$update public.payments set provider_trade_no = '  ' where merchant_trade_no = %L$$, current_setting('p8.atm')),
  '23514', null, 'provider_trade_no 不能只有空白（資料表限制）');
select throws_ok(
  $$insert into public.payment_anomalies (source, kind, merchant_trade_no, resolved_at)
    values ('notify', 'amount_mismatch', 'X', now())$$,
  '23514', null, '處理時間與說明必須同時存在');

select * from finish();
rollback;
