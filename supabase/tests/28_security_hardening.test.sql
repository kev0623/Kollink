-- 資安修正（資料庫）：20261129000100_security_hardening.sql、20261129000200_admin_mfa.sql
-- 每一項都有「攻擊被擋」與「合法路徑仍可用」。id 前綴 …0000000e5xxx，handle 前綴 sechard_。
begin;
create extension if not exists pgtap with schema extensions;
select plan(147);

-- ── 測試資料（postgres 身分）──
-- e5001 品牌 B1、e5002 品牌 B2、e5003 管理員兼品牌 AB
-- e5011 C1 approved、e5012 C2 approved（之後停權）、e5013 C3 pending、e5014 C4 approved、e5015 C5 rejected、e5016 C6 approved
-- e5020 N1、e5021 N2 沒有 profile；e5030 AD 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e5001', 'sechard-b1@test.local'),
  ('00000000-0000-0000-0000-0000000e5002', 'sechard-b2@test.local'),
  ('00000000-0000-0000-0000-0000000e5003', 'sechard-ab@test.local'),
  ('00000000-0000-0000-0000-0000000e5011', 'sechard-c1@test.local'),
  ('00000000-0000-0000-0000-0000000e5012', 'sechard-c2@test.local'),
  ('00000000-0000-0000-0000-0000000e5013', 'sechard-c3@test.local'),
  ('00000000-0000-0000-0000-0000000e5014', 'sechard-c4@test.local'),
  ('00000000-0000-0000-0000-0000000e5015', 'sechard-c5@test.local'),
  ('00000000-0000-0000-0000-0000000e5016', 'sechard-c6@test.local'),
  ('00000000-0000-0000-0000-0000000e5020', 'sechard-n1@test.local'),
  ('00000000-0000-0000-0000-0000000e5021', 'sechard-n2@test.local'),
  ('00000000-0000-0000-0000-0000000e5030', 'sechard-ad@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000e5001', 'brand', '資安品牌一'),
  ('00000000-0000-0000-0000-0000000e5002', 'brand', '資安品牌二'),
  ('00000000-0000-0000-0000-0000000e5003', 'brand', '資安管理員品牌'),
  ('00000000-0000-0000-0000-0000000e5011', 'creator', '資安創作者一'),
  ('00000000-0000-0000-0000-0000000e5012', 'creator', '資安創作者二'),
  ('00000000-0000-0000-0000-0000000e5013', 'creator', '資安待審'),
  ('00000000-0000-0000-0000-0000000e5014', 'creator', '資安創作者四'),
  ('00000000-0000-0000-0000-0000000e5015', 'creator', '資安退回'),
  ('00000000-0000-0000-0000-0000000e5016', 'creator', '資安創作者六');
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-0000000e5003'), ('00000000-0000-0000-0000-0000000e5030');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000e5001', '資安品牌一'),
  ('00000000-0000-0000-0000-0000000e5002', '資安品牌二'),
  ('00000000-0000-0000-0000-0000000e5003', '資安管理員品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status, review_note) values
  ('00000000-0000-0000-0000-0000000e5011', 'sechard_c1', 'sechard_c1', 'approved', null),
  ('00000000-0000-0000-0000-0000000e5012', 'sechard_c2', 'sechard_c2', 'approved', null),
  ('00000000-0000-0000-0000-0000000e5013', 'sechard_c3', 'sechard_c3', 'pending', null),
  ('00000000-0000-0000-0000-0000000e5014', 'sechard_c4', 'sechard_c4', 'approved', null),
  ('00000000-0000-0000-0000-0000000e5015', 'sechard_c5', 'sechard_c5', 'rejected', '找不到驗證碼'),
  ('00000000-0000-0000-0000-0000000e5016', 'sechard_c6', 'sechard_c6', 'approved', null);
insert into public.briefs
  (id, brand_id, title, description, collab_types, includes_product, deadline, status, published_at) values
  ('00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5001',
   '資安招募', '說明', array['IG 貼文'], true, public.today_tw() + 7, 'open', now()),
  ('00000000-0000-0000-0000-0000000e5f02', '00000000-0000-0000-0000-0000000e5001',
   '資安招募二', '說明', array['IG 貼文'], true, public.today_tw() + 7, 'open', now());
insert into public.brief_applications (id, brief_id, creator_id, proposed_price_twd) values
  ('00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5011', 5000),
  ('00000000-0000-0000-0000-0000000e5a02', '00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5012', 5000),
  ('00000000-0000-0000-0000-0000000e5a04', '00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5014', 5000),
  ('00000000-0000-0000-0000-0000000e5a05', '00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5016', 5000),
  ('00000000-0000-0000-0000-0000000e5a06', '00000000-0000-0000-0000-0000000e5f02', '00000000-0000-0000-0000-0000000e5011', null),
  ('00000000-0000-0000-0000-0000000e5a07', '00000000-0000-0000-0000-0000000e5f02', '00000000-0000-0000-0000-0000000e5014', 8000);
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000000e5c01', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5015'),
  ('00000000-0000-0000-0000-0000000e5c02', '00000000-0000-0000-0000-0000000e5003', '00000000-0000-0000-0000-0000000e5014'),
  ('00000000-0000-0000-0000-0000000e5c03', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5012'),
  ('00000000-0000-0000-0000-0000000e5c04', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5011');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-0000000e5b01', '00000000-0000-0000-0000-0000000e5c02',
   '00000000-0000-0000-0000-0000000e5014', '加我電話 0912345678');
-- d01 B1–C2 待付款、d02 B1–C2 邀約中、d03 AB–C4 審稿中、d04 B1–C1 待交稿、d05 B1–C1 待付款（ATM 待繳）
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5012',
   '00000000-0000-0000-0000-0000000e5c03', '資安待付款', 'x', 3000, 'awaiting_payment'),
  ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5012',
   '00000000-0000-0000-0000-0000000e5c03', '資安邀約', 'x', 3000, 'invited'),
  ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5003', '00000000-0000-0000-0000-0000000e5014',
   '00000000-0000-0000-0000-0000000e5c02', '資安管理員的案', 'x', 3000, 'in_review'),
  ('00000000-0000-0000-0000-0000000e5d04', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5011',
   '00000000-0000-0000-0000-0000000e5c04', '資安待交稿', 'x', 3000, 'awaiting_submission'),
  ('00000000-0000-0000-0000-0000000e5d05', '00000000-0000-0000-0000-0000000e5001', '00000000-0000-0000-0000-0000000e5011',
   '00000000-0000-0000-0000-0000000e5c04', '資安 ATM', 'x', 3000, 'awaiting_payment');
insert into public.payments
  (collaboration_id, provider, merchant_trade_no, amount_twd, status, provider_trade_no, payment_method,
   atm_bank_code, atm_v_account, atm_expire_date)
values
  ('00000000-0000-0000-0000-0000000e5d05', 'ecpay', 'KLSECHARD00000000005', 3000, 'pending', 'P5', 'atm',
   '812', '9999888877776666', current_date + 3),
  ('00000000-0000-0000-0000-0000000e5d03', 'ecpay', 'KLSECHARD00000000003', 3000, 'paid', 'P3', 'credit',
   null, null, null);
insert into public.payment_anomalies (source, kind, merchant_trade_no, provider_trade_no, payment_id, collaboration_id) values
  ('notify', 'amount_mismatch', 'KLSECHARD00000000003', 'A1', null, '00000000-0000-0000-0000-0000000e5d03'),
  ('notify', 'price_mismatch', 'KLSECHARD00000000003', 'A2',
   (select id from public.payments where merchant_trade_no = 'KLSECHARD00000000003'), null),
  ('notify', 'unknown_trade_no', 'KLSECHARDNOPE', 'A3', null, null);
select set_config('sh.an1', (select id::text from public.payment_anomalies where merchant_trade_no like 'KLSECHARD%' and provider_trade_no = 'A1'), true);
select set_config('sh.an2', (select id::text from public.payment_anomalies where merchant_trade_no like 'KLSECHARD%' and provider_trade_no = 'A2'), true);
select set_config('sh.an3', (select id::text from public.payment_anomalies where merchant_trade_no like 'KLSECHARD%' and provider_trade_no = 'A3'), true);

-- ===== 10. (L6) 預設權限與 anon 授權 =====
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anon 不能讀 profiles');
select ok(not has_table_privilege('anon', 'public.brand_profiles', 'SELECT'), 'anon 不能讀 brand_profiles');
select ok(not has_table_privilege('anon', 'public.audit_logs', 'SELECT')
          and not has_column_privilege('anon', 'public.audit_logs', 'note', 'SELECT'), 'anon 不能讀 audit_logs');
select ok(not has_table_privilege('anon', 'public.creator_rates', 'SELECT'), 'anon 不能讀 creator_rates');
select ok(not has_column_privilege('anon', 'public.creator_profiles', 'review_note', 'SELECT'), 'anon 讀不到 review_note');
select ok(has_column_privilege('anon', 'public.creator_profiles', 'handle', 'SELECT')
          and has_table_privilege('anon', 'public.creator_portfolio_items', 'SELECT'), 'anon 仍可讀公開頁需要的欄位與作品');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['get_public_creator'], 'anon 只能執行 get_public_creator');
select ok(not has_sequence_privilege('authenticated', 'public.audit_logs_id_seq', 'USAGE')
          and not has_sequence_privilege('anon', 'public.payment_anomalies_id_seq', 'USAGE'), 'API 角色沒有 sequence 權限');
create table public.sechard_tmp (x integer);
create function public.sechard_tmp_fn() returns integer language sql as $$ select 1 $$;
select ok(not has_table_privilege('anon', 'public.sechard_tmp', 'SELECT')
          and not has_table_privilege('authenticated', 'public.sechard_tmp', 'SELECT'), '新資料表不會自動授權給 anon／authenticated');
select ok(not has_function_privilege('anon', 'public.sechard_tmp_fn()', 'EXECUTE')
          and not has_function_privilege('authenticated', 'public.sechard_tmp_fn()', 'EXECUTE'), '新函式不會自動授權給 anon／authenticated');
select ok(has_table_privilege('service_role', 'public.sechard_tmp', 'SELECT'), 'service_role 的預設權限不變');
drop function public.sechard_tmp_fn();
drop table public.sechard_tmp;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.creator_profiles where handle like 'sechard\_%'), 4, '訪客讀得到已核准的創作者（公開頁）');
select throws_ok($$select count(*) from public.profiles$$, '42501', null, '訪客不能讀 profiles');
reset role;

-- ===== 7. (L3) profiles／brand_profiles 收斂、audit_logs 不給 actor_id =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5020","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where display_name like '資安%'), 4, '沒有 profile 的帳號只讀得到已核准創作者的 profile');
select is((select count(*)::int from public.brand_profiles where brand_name like '資安%'), 0, '沒有 profile 的帳號讀不到任何品牌');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select is((select array_agg(display_name order by display_name) from public.profiles where display_name like '資安%'),
  array['資安創作者一', '資安創作者二', '資安創作者六', '資安創作者四', '資安品牌一', '資安退回'],
  '品牌讀得到自己、已核准創作者、有對話的對象（被退回的也算）；讀不到待審與其他品牌');
select is((select role::text || '/' || display_name from public.profiles where id = auth.uid()), 'brand/資安品牌一',
  '讀自己的 profile（current-user.ts）');
select is((select brand_name from public.brand_profiles where user_id = auth.uid()), '資安品牌一',
  '讀自己的 brand_profiles（current-user.ts）');
select is((select count(*)::int from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000e5015'), 0,
  'creator_profiles 不因對話關係開放（review_note 只給本人）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select is((select array_agg(brand_name order by brand_name) from public.brand_profiles where brand_name like '資安%'),
  array['資安品牌一'], '創作者只讀得到有關係的品牌');
select is(
  (select b.title || '/' || bp.brand_name
     from public.brief_applications a join public.briefs b on b.id = a.brief_id
     join public.brand_profiles bp on bp.user_id = b.brand_id
    where a.id = '00000000-0000-0000-0000-0000000e5a01'),
  '資安招募/資安品牌一', '我的報名列表讀得到招募的品牌名稱（briefs/view.ts MY_APPLICATION_COLUMNS）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5014","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000e5003'), 1,
  '有對話的品牌讀得到（管理員兼品牌也一樣）');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000e5002'), 0,
  '沒有關係的品牌讀不到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.profiles where display_name like '資安%'), 9, '管理員讀得到全部');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select throws_ok($$select actor_id from public.audit_logs$$, '42501', null, '參與者讀不到 audit_logs.actor_id');
select ok((select count(*) from public.audit_logs where collaboration_id = '00000000-0000-0000-0000-0000000e5d04') >= 1,
  '參與者仍讀得到合作案事件的其他欄位');
reset role;

-- ===== 9. (L5) ATM 欄位與 get_my_payment_details =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select throws_ok($$select atm_v_account from public.payments$$, '42501', null, '創作者讀不到 ATM 虛擬帳號');
select throws_ok($$select merchant_trade_no from public.payments$$, '42501', null, '創作者讀不到綠界單號');
select is(
  (select status || '/' || amount_twd || '/' || payment_method from public.payments
    where collaboration_id = '00000000-0000-0000-0000-0000000e5d05'),
  'pending/3000/atm', '創作者仍讀得到付款狀態');
select is(
  (select count(*)::int || '/' || coalesce(max(d.atm_v_account), 'null') || '/' || max(d.status)
     from public.get_my_payment_details('00000000-0000-0000-0000-0000000e5d05') d),
  '1/null/pending', 'get_my_payment_details：創作者拿到付款單但沒有 ATM 資訊');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select throws_ok($$select provider_trade_no from public.payments$$, '42501', null, '品牌也不能直接讀交易編號');
select is(
  (select d.atm_bank_code || '/' || d.atm_v_account || '/' || (d.atm_expire_date = current_date + 3)::text || '/' || d.amount_twd
     from public.get_my_payment_details('00000000-0000-0000-0000-0000000e5d05') d),
  '812/9999888877776666/true/3000', 'get_my_payment_details：品牌拿到 ATM 轉帳資訊');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5002","role":"authenticated"}', true);
select throws_ok($$select * from public.get_my_payment_details('00000000-0000-0000-0000-0000000e5d05')$$,
  'P0002', 'collaboration not found', '非參與者：找不到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is((select d.atm_v_account from public.get_my_payment_details('00000000-0000-0000-0000-0000000e5d05') d),
  '9999888877776666', '管理員拿到 ATM 資訊');
reset role;
select ok(not has_function_privilege('anon', 'public.get_my_payment_details(uuid)', 'EXECUTE'), 'anon 不能呼叫 get_my_payment_details');

-- ===== 1. (M1) 低於報價的錄取要創作者同意；創作者付款前可以退出 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select set_config('sh.app1', public.accept_application_with_collab('00000000-0000-0000-0000-0000000e5a01', 1, 'IG 貼文 10 篇')::text, true);
select is((select status::text from public.collaborations where id = current_setting('sh.app1')::uuid), 'invited',
  '錄取金額低於創作者報價：合作案從 invited 開始（要創作者確認）');
select throws_ok(
  $$select * from public.create_payment_order(current_setting('sh.app1')::uuid, 'credit')$$,
  '55000', 'collaboration not awaiting payment', '創作者確認前品牌不能建付款單');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select is(public.transition_collaboration(current_setting('sh.app1')::uuid, 'accept'), 'awaiting_payment'::public.collab_status,
  '創作者接受低於報價的條件：進入待付款');
select throws_ok(
  $$select public.transition_collaboration(current_setting('sh.app1')::uuid, 'decline')$$,
  '22023', null, '待付款不能婉拒（只能退出）');
select is(public.transition_collaboration(current_setting('sh.app1')::uuid, 'cancel'), 'cancelled'::public.collab_status,
  '創作者在待付款時可以退出');
select is(
  (select actor_kind || '/' || action || '/' || from_status::text || '/' || to_status::text from public.audit_logs
    where collaboration_id = current_setting('sh.app1')::uuid and action = 'cancel'),
  'creator/cancel/awaiting_payment/cancelled', '事件記錄是創作者退出');
select is((select status from public.brief_applications where id = '00000000-0000-0000-0000-0000000e5a01'), 'accepted',
  '報名維持 accepted（不重開）');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-0000000e5d04', 'cancel')$$,
  '22023', null, '已付款（待交稿）後創作者不能退出');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-0000000e5d05', 'cancel')$$,
  '55000', 'payment in progress', '品牌已取得未逾期的 ATM 帳號後創作者不能退出');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select set_config('sh.app4', public.accept_application_with_collab('00000000-0000-0000-0000-0000000e5a04', 6000, 'IG 貼文 1 篇')::text, true);
select is((select status::text from public.collaborations where id = current_setting('sh.app4')::uuid),
  'awaiting_payment', '品牌可以錄取別人；金額高於報價：直接待付款');
select set_config('sh.app5', public.accept_application_with_collab('00000000-0000-0000-0000-0000000e5a05', 5000, 'IG 貼文 1 篇')::text, true);
select is((select status::text from public.collaborations where id = current_setting('sh.app5')::uuid),
  'awaiting_payment', '金額等於報價：直接待付款');
select set_config('sh.app6', public.accept_application_with_collab('00000000-0000-0000-0000-0000000e5a06', 1, 'IG 貼文 1 篇')::text, true);
select is((select status::text from public.collaborations where id = current_setting('sh.app6')::uuid),
  'awaiting_payment', '創作者沒有報價：直接待付款');
select set_config('sh.app7', public.accept_application_with_collab('00000000-0000-0000-0000-0000000e5a07', 7999, 'IG 貼文 1 篇')::text, true);
select is((select status::text from public.collaborations where id = current_setting('sh.app7')::uuid), 'invited',
  '低於報價 1 元也要創作者確認');
select is(public.transition_collaboration(current_setting('sh.app7')::uuid, 'cancel'), 'cancelled'::public.collab_status,
  '品牌可以撤回等待創作者確認的錄取');
select set_config('sh.inv', public.invite_creator('00000000-0000-0000-0000-0000000e5011', '重新邀請', 'IG 貼文 1 篇', 5000)::text, true);
select is((select status::text from public.collaborations where id = current_setting('sh.inv')::uuid), 'invited',
  '品牌可以重新邀請退出的創作者');

-- ===== 2. (M2) 邀請流量限制 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5002","role":"authenticated"}', true);
select lives_ok(
  $q$do $$
  begin
    for i in 1..30 loop
      perform public.transition_collaboration(
        public.invite_creator('00000000-0000-0000-0000-0000000e5011', '邀請 ' || i, 'IG 貼文 1 篇', 1000), 'cancel');
    end loop;
  end;
  $$$q$,
  '24 小時內 30 次邀請（含取消）都可以');
select is((select count(*)::int from public.collaborations where brand_id = auth.uid()), 30, '建立了 30 筆');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-0000000e5014', '第 31 次', 'IG 貼文 1 篇', 1000)$$,
  '54000', 'too many invites', '第 31 次邀請被擋（換創作者也一樣）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-0000000e5016', '別的品牌不受影響', 'IG 貼文 1 篇', 1000)$$,
  '其他品牌不受影響');

-- ===== 3. (M3) 停權擋住新合作 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is(public.set_creator_status('00000000-0000-0000-0000-0000000e5012', 'suspend', '違規'), 'suspended', '管理員停權 C2');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5012","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-0000000e5d02', 'accept')$$,
  '55000', 'creator not approved', '停權的創作者不能接受邀約');
select is(public.transition_collaboration('00000000-0000-0000-0000-0000000e5d02', 'decline'), 'declined'::public.collab_status,
  '停權的創作者仍可以婉拒');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-0000000e5a02', 5000, 'IG 貼文 1 篇')$$,
  '55000', 'creator not approved', '品牌不能錄取停權創作者的報名');
select is((select status from public.brief_applications where id = '00000000-0000-0000-0000-0000000e5a02'), 'applied',
  '報名維持 applied');
select throws_ok(
  $$select * from public.create_payment_order('00000000-0000-0000-0000-0000000e5d01', 'credit')$$,
  '55000', 'creator not approved', '停權創作者的合作案不能建付款單');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is(public.admin_record_offline_payment('00000000-0000-0000-0000-0000000e5d01', '品牌線下匯款'), 'paid',
  '管理員人工付款不擋（管理員判斷）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select is(public.transition_collaboration(current_setting('sh.inv')::uuid, 'accept'), 'awaiting_payment'::public.collab_status,
  '已核准的創作者照常接受邀約');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select is((select count(*)::int from public.create_payment_order(current_setting('sh.inv')::uuid, 'credit')), 1,
  '已核准創作者的合作案照常建付款單');

-- ===== 4. (M4) 粉絲數上限與變更紀錄 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select throws_ok(
  $$select public.update_creator_account('資安創作者一', 'sechard_c1', 'sechard_c1', 100000001, '台北市', array['美妝'])$$,
  '22023', 'invalid follower_count', '粉絲數超過 1 億被擋');
select throws_ok(
  $$select public.update_creator_public_profile(null, '{}', '{}', 100.01, null, null)$$,
  '22023', 'invalid engagement_rate', '互動率超過 100 被擋');
select lives_ok(
  $$select public.update_creator_account('資安創作者一', 'sechard_c1', 'sechard_c1', 100000000, '台北市', array['美妝'])$$,
  '粉絲數 1 億可以');
select lives_ok($$select public.update_creator_public_profile(null, '{}', '{}', 55.5, null, null)$$, '互動率可以修改');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'approved', '狀態不變');
select is((select count(*)::int from public.audit_logs where action = 'creator_stats_changed'), 0, '創作者自己讀不到紀錄（只有管理員）');
select lives_ok(
  $$select public.update_creator_account('資安創作者一', 'sechard_c1', 'sechard_c1', 100000000, '台北市', array['美妝'])$$,
  '數字沒變再存一次');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5013","role":"authenticated"}', true);
select lives_ok(
  $$select public.update_creator_account('資安待審', 'sechard_c3', 'sechard_c3', 5000, '台北市', array['美妝'])$$,
  '待審的創作者改粉絲數');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5021","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_creator_account('資安新人', 'sechard_n2', 'sechard_n2', 100000001, '台北市', array['美妝'])$$,
  '22023', 'invalid follower_count', '建立帳號時粉絲數超過 1 億被擋');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is(
  (select array_agg(actor_kind || '|' || coalesce(collaboration_id::text, 'null') || '|' || note order by id)
     from public.audit_logs
    where action = 'creator_stats_changed' and subject_id = '00000000-0000-0000-0000-0000000e5011'),
  array['creator|null|follower_count 0→100000000', 'creator|null|engagement_rate null→55.50'],
  '已核准的創作者改數字：寫 creator_stats_changed（只記變更的欄位，舊值→新值）');
select is((select count(*)::int from public.audit_logs
            where action = 'creator_stats_changed' and subject_id = '00000000-0000-0000-0000-0000000e5013'), 0,
  '待審的創作者不寫紀錄');
reset role;
select is(
  (select actor_id::text from public.audit_logs
    where action = 'creator_stats_changed' and subject_id = '00000000-0000-0000-0000-0000000e5011' order by id limit 1),
  '00000000-0000-0000-0000-0000000e5011', 'actor 是創作者本人');
update public.creator_profiles set follower_count = 777
 where user_id in ('00000000-0000-0000-0000-0000000e5012', '00000000-0000-0000-0000-0000000e5015');
select is((select note from public.audit_logs
            where action = 'creator_stats_changed' and subject_id = '00000000-0000-0000-0000-0000000e5012'),
  'follower_count 0→777', '停權中的創作者改數字也寫紀錄');
select is((select note from public.audit_logs
            where action = 'creator_stats_changed' and subject_id = '00000000-0000-0000-0000-0000000e5015'),
  'follower_count 0→777', '被退回的創作者改數字也寫紀錄');
select throws_ok(
  $$update public.creator_profiles set follower_count = 100000001 where user_id = '00000000-0000-0000-0000-0000000e5013'$$,
  '23514', null, '資料表 CHECK 也擋超過 1 億');
select ok((select convalidated from pg_constraint where conname = 'creator_profiles_follower_count_max'), 'CHECK 已驗證既有資料');

-- ===== 5. (L1) Storage 副檔名與數量上限 =====
insert into storage.objects (bucket_id, name)
select 'brand-logos', '00000000-0000-0000-0000-0000000e5020/pre' || g || '.png' from generate_series(1, 39) g;
insert into storage.objects (bucket_id, name)
select 'creator-media', '00000000-0000-0000-0000-0000000e5011/portfolio-pre' || g || '.jpg' from generate_series(1, 119) g;
insert into storage.objects (bucket_id, name)
select 'brief-covers', '00000000-0000-0000-0000-0000000e5001/cover-pre' || g || '.jpg' from generate_series(1, 299) g;
insert into storage.objects (bucket_id, name)
select 'deliverables', '00000000-0000-0000-0000-0000000e5d04/00000000-0000-0000-0000-0000000e5011/' || gen_random_uuid() || '.jpg'
  from generate_series(1, 199);
set local role authenticated;
-- brand-logos：onboarding 時還沒有 profile
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5020","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000e5020/x.svg')$$,
  '42501', null, 'brand-logos：副檔名不在白名單');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000e5020/x.html')$$,
  '42501', null, 'brand-logos：不能上傳 html');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000e5020/logo.webp')$$,
  'brand-logos：沒有 profile 的帳號（onboarding）可以上傳第 40 個');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000e5020/logo2.png')$$,
  '42501', null, 'brand-logos：第 41 個被擋');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000e5021/logo3.png')$$,
  '42501', null, 'brand-logos：換資料夾繞不過');
select throws_ok(
  $$update storage.objects set name = '00000000-0000-0000-0000-0000000e5020/logo.html'
     where bucket_id = 'brand-logos' and name = '00000000-0000-0000-0000-0000000e5020/logo.webp'$$,
  '42501', null, 'brand-logos：不能改名成其他副檔名');
-- creator-media
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000e5011/avatar-x.gif')$$,
  '42501', null, 'creator-media：副檔名不在白名單');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000e5011/avatar-x.JPG')$$,
  'creator-media：第 120 個可以（副檔名不分大小寫）');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000e5011/avatar-y.jpg')$$,
  '42501', null, 'creator-media：第 121 個被擋');
-- brief-covers
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000e5001/cover-x.svg')$$,
  '42501', null, 'brief-covers：副檔名不在白名單');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000e5001/cover-x.jpeg')$$,
  'brief-covers：第 300 個可以');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000e5001/cover-y.png')$$,
  '42501', null, 'brief-covers：第 301 個被擋');
-- deliverables：每個合作案資料夾 200 個
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5011","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000e5d04/00000000-0000-0000-0000-0000000e5011/5ec0a2d0-0000-4000-8000-000000000001.jpg')$$,
  'deliverables：第 200 個可以');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000e5d04/00000000-0000-0000-0000-0000000e5011/5ec0a2d0-0000-4000-8000-000000000002.jpg')$$,
  '42501', null, 'deliverables：第 201 個被擋');

-- ===== 8. (L4) 品牌只讀得到已交出的檔案 =====
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'
            and name like '00000000-0000-0000-0000-0000000e5d04/%'), 200, '創作者讀得到自己合作案的全部檔案');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'
            and name like '00000000-0000-0000-0000-0000000e5d04/%'), 0, '品牌讀不到還沒交出的檔案');
reset role;
insert into public.collaboration_submissions (collaboration_id, round, file_paths) values
  ('00000000-0000-0000-0000-0000000e5d04', 1,
   array['00000000-0000-0000-0000-0000000e5d04/00000000-0000-0000-0000-0000000e5011/5ec0a2d0-0000-4000-8000-000000000001.jpg']);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select is((select array_agg(name) from storage.objects where bucket_id = 'deliverables'
            and name like '00000000-0000-0000-0000-0000000e5d04/%'),
  array['00000000-0000-0000-0000-0000000e5d04/00000000-0000-0000-0000-0000000e5011/5ec0a2d0-0000-4000-8000-000000000001.jpg'],
  '品牌讀得到已交出的檔案（signed URL 用）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'
            and name like '00000000-0000-0000-0000-0000000e5d04/%'), 200, '管理員讀得到全部');

-- ===== 6. (L2) 管理員兼參與者 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-0000000e5014', 'suspend', '想停權合作對象')$$,
  '42501', 'admin is participant', '管理員不能停權有進行中合作的對象');
select throws_ok(
  $$select public.mark_message_reviewed('00000000-0000-0000-0000-0000000e5b01')$$,
  '42501', 'admin is participant', '管理員不能審自己對話裡的訊息');
select throws_ok(
  format($$select public.resolve_payment_anomaly(%s, '自己處理')$$, current_setting('sh.an1')),
  '42501', 'admin is participant', '管理員不能處理自己合作案的異常');
select throws_ok(
  format($$select public.resolve_payment_anomaly(%s, '自己處理')$$, current_setting('sh.an2')),
  '42501', 'admin is participant', '異常只對到付款單：依付款單所屬合作案判斷');
select lives_ok(
  format($$select public.resolve_payment_anomaly(%s, '查無此單，忽略')$$, current_setting('sh.an3')),
  '對不到合作案的異常照常處理');
select is(public.set_creator_status('00000000-0000-0000-0000-0000000e5016', 'suspend', '違規'), 'suspended',
  '管理員可以停權沒有合作關係的創作者');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  format($$select public.resolve_payment_anomaly(%s, '已確認')$$, current_setting('sh.an1')),
  '其他管理員可以處理');
select is(public.mark_message_reviewed('00000000-0000-0000-0000-0000000e5b01'), true, '其他管理員可以審訊息');
select is(public.set_creator_status('00000000-0000-0000-0000-0000000e5016', 'unsuspend'), 'approved', '其他管理員可以恢復');
select is(
  (select resolved_by::text from public.payment_anomalies where id = current_setting('sh.an1')::bigint),
  '00000000-0000-0000-0000-0000000e5030', 'resolved_by 記下處理人');
reset role;
select is(
  (select actor_kind || '|' || actor_id::text || '|' || coalesce(collaboration_id::text, 'null') || '|' || subject_id::text || '|' || note
     from public.audit_logs
    where action = 'payment_anomaly_resolved' and note = 'anomaly ' || current_setting('sh.an1')),
  'admin|00000000-0000-0000-0000-0000000e5030|null|00000000-0000-0000-0000-0000000e5d03|anomaly ' || current_setting('sh.an1'),
  '處理異常寫 audit（合作案記在 subject_id，參與者讀不到）');
select is(
  (select coalesce(subject_id::text, 'null') || '|' || actor_kind from public.audit_logs
    where action = 'payment_anomaly_resolved' and note = 'anomaly ' || current_setting('sh.an3')),
  'null|admin', '對不到合作案的異常：subject_id 是 null');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  format($$select public.resolve_payment_anomaly(%s, '備用 SQL')$$, current_setting('sh.an2')),
  'service_role（system）處理不受參與者限制');
reset role;
select is(
  (select coalesce(resolved_by::text, 'null') from public.payment_anomalies where id = current_setting('sh.an2')::bigint),
  'null', 'system 處理時 resolved_by 是 null');

-- ===== 11. (L7) 超長文字先擋 =====
select throws_ok($$select public.clean_text(repeat('a', 200001))$$, '22023', 'text too long', 'clean_text：超過 200,000 bytes 拒絕');
select throws_ok($$select public.clean_text(repeat('字', 66667))$$, '22023', 'text too long', 'clean_text：以 bytes 計算（中文 3 bytes）');
select is(char_length(public.clean_text(' ' || repeat('a', 199998) || ' ')), 199998, 'clean_text：上限內照常清理');
select is(public.clean_text(null), null, 'clean_text：null 回 null');
select throws_ok($$select public.has_bidi(repeat('a', 200001))$$, '22023', 'text too long', 'has_bidi：超長拒絕');
select is(public.has_bidi(E'a‮b') || '/' || public.has_bidi(null), 'true/false', 'has_bidi：行為不變');
select throws_ok($$select public.has_contact_info(repeat('a', 200001))$$, '22023', 'text too long', 'has_contact_info：超長拒絕');
select is(public.has_contact_info('加我 line id: abc') || '/' || public.has_contact_info(null), 'true/false', 'has_contact_info：行為不變');
select is(
  (select array_agg(p.proname::text || ':' || p.provolatile::text order by p.proname) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('clean_text', 'has_bidi', 'has_contact_info')),
  array['clean_text:i', 'has_bidi:i', 'has_contact_info:i'], '三個 helper 仍是 immutable');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated"}', true);
select throws_ok($$select public.update_brand_account(repeat('a', 300000), null, null)$$, '22023', 'text too long',
  'RPC 收到超長字串：不跑 regex 直接拒絕');
select lives_ok($$select public.update_brand_account('資安品牌一', '食品飲料', null)$$, 'RPC 正常輸入照常');

-- ===== 12. (L8) 收藏只接受已核准的創作者 =====
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id) values (auth.uid(), '00000000-0000-0000-0000-0000000e5013')$$,
  '42501', null, '收藏待審的創作者：RLS 錯誤');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id) values (auth.uid(), '00000000-0000-0000-0000-0000000e5999')$$,
  '42501', null, '收藏不存在的創作者：同一個錯誤（不是 FK 錯誤）');
select lives_ok(
  $$insert into public.creator_favorites (brand_id, creator_id) values (auth.uid(), '00000000-0000-0000-0000-0000000e5014')$$,
  '收藏已核准的創作者照常');

-- ===== 13. (App-M3) 管理員要 aal2 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal1"}', true);
select is(public.is_admin(), false, 'aal1 的管理員：is_admin() 是 false');
select is(public.is_admin_account(), true, 'aal1 的管理員：is_admin_account() 是 true');
select throws_ok($$select * from public.admin_overview()$$, '42501', 'not admin', 'aal1：admin_overview 被拒');
select throws_ok($$select * from public.admin_list_creators('pending', null, 50, 0)$$, '42501', 'not admin', 'aal1：admin_list_creators 被拒');
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-0000000e5013', 'approve')$$,
  '42501', 'not admin', 'aal1：set_creator_status 被拒');
select throws_ok(
  $$select public.admin_record_offline_payment('00000000-0000-0000-0000-0000000e5d05', '線下')$$,
  '42501', 'not admin', 'aal1：admin_record_offline_payment 被拒');
select throws_ok(
  $$select public.mark_message_reviewed('00000000-0000-0000-0000-0000000e5b01')$$,
  '42501', 'not admin', 'aal1：mark_message_reviewed 被拒');
select is((select count(*)::int from public.payment_anomalies where merchant_trade_no like 'KLSECHARD%'), 0,
  'aal1：讀不到 payment_anomalies');
select is((select count(*)::int from public.message_reviews where message_id = '00000000-0000-0000-0000-0000000e5b01'), 0,
  'aal1：讀不到 message_reviews');
select is((select count(*)::int from public.profiles where display_name like '資安%'), 3,
  'aal1：profiles 只看得到已核准的創作者（C2 已停權；與沒有關係的一般帳號相同）');
select throws_ok($$select * from public.get_my_payment_details('00000000-0000-0000-0000-0000000e5d05')$$,
  'P0002', 'collaboration not found', 'aal1：讀不到別人的付款資訊');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated"}', true);
select is(public.is_admin(), false, '沒有 aal claim：不是管理員');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5030","role":"authenticated","aal":"aal2"}', true);
select is(public.is_admin(), true, 'aal2 的管理員：is_admin() 是 true');
select lives_ok($$select * from public.admin_overview()$$, 'aal2：admin_overview 可以');
select is((select count(*)::int from public.payment_anomalies where merchant_trade_no like 'KLSECHARD%'), 3,
  'aal2：讀得到 payment_anomalies');
select is((select count(*)::int from public.message_reviews where message_id = '00000000-0000-0000-0000-0000000e5b01'), 1,
  'aal2：讀得到 message_reviews');
-- 管理員兼品牌、aal1：以品牌身分照常操作，管理員功能拿不到
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5003","role":"authenticated","aal":"aal1"}', true);
select is(public.my_role()::text || '/' || public.is_admin()::text, 'brand/false', 'aal1 的管理員兼品牌：仍是品牌、不是管理員');
select is(public.transition_collaboration('00000000-0000-0000-0000-0000000e5d03', 'approve'), 'awaiting_publish'::public.collab_status,
  'aal1 的管理員兼品牌：品牌操作照常');
-- 一般使用者（GoTrue 一律帶 aal1）不受影響
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e5001","role":"authenticated","aal":"aal1"}', true);
select is(public.is_admin_account(), false, '一般使用者：is_admin_account() 是 false');
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-0000000e5014', 'aal1 品牌邀請', 'IG 貼文 1 篇', 1000)$$,
  '一般使用者（aal1）照常操作');
reset role;
select ok(has_function_privilege('authenticated', 'public.is_admin_account()', 'EXECUTE')
          and not has_function_privilege('anon', 'public.is_admin_account()', 'EXECUTE'), 'is_admin_account 只授權給 authenticated');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.set_creator_status('00000000-0000-0000-0000-0000000e5013', 'approve'), 'approved',
  'service_role（system）不看 aal，備用 SQL 照常');

select * from finish();
rollback;
