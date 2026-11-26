begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- a01 品牌、a11／a12 待審核創作者、a13 已審核創作者、a19 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'p9-b1@test.local'),
  ('00000000-0000-0000-0000-000000000a11', 'p9-c1@test.local'),
  ('00000000-0000-0000-0000-000000000a12', 'p9-c2@test.local'),
  ('00000000-0000-0000-0000-000000000a13', 'p9-c3@test.local'),
  ('00000000-0000-0000-0000-000000000a19', 'p9-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000a01', 'brand', '九號品牌'),
  ('00000000-0000-0000-0000-000000000a11', 'creator', '九號一'),
  ('00000000-0000-0000-0000-000000000a12', 'creator', '九號二'),
  ('00000000-0000-0000-0000-000000000a13', 'creator', '九號三');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000a19');
insert into public.brand_profiles (user_id, brand_name) values ('00000000-0000-0000-0000-000000000a01', '九號品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000a11', 'admtest_one', 'admtest_one', 'pending'),
  ('00000000-0000-0000-0000-000000000a12', 'admtest_two', 'admtest_two', 'pending'),
  ('00000000-0000-0000-0000-000000000a13', 'admtest_three', 'admtest_three', 'approved');
insert into public.creator_verifications (user_id, code) values
  ('00000000-0000-0000-0000-000000000a11', 'ABCDEF');
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-000000000a13', '00000000-0000-0000-0000-000000000a13/portfolio-a.jpg', 0),
  ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000000a11/portfolio-a.jpg', 0);
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000aa01',
   '00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a13');
-- m1 含電話（trigger 會標記 flagged_contact）、m2 一般訊息
insert into public.messages (id, conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000aa01',
   '00000000-0000-0000-0000-000000000a01', '加我電話 0912345678'),
  ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-00000000aa01',
   '00000000-0000-0000-0000-000000000a01', '你好');

-- ===== 1. is_admin／my_role 的 EXECUTE =====
select ok(not has_function_privilege('anon', 'public.is_admin()', 'execute'), 'anon 不能呼叫 is_admin');
select ok(not has_function_privilege('anon', 'public.my_role()', 'execute'), 'anon 不能呼叫 my_role');
select ok(has_function_privilege('authenticated', 'public.is_admin()', 'execute'), 'authenticated 可以呼叫 is_admin（policy 需要）');
select ok(has_function_privilege('authenticated', 'public.my_role()', 'execute'), 'authenticated 可以呼叫 my_role（policy 需要）');
select ok(not has_function_privilege('authenticated', 'public.admin_actor()', 'execute'), 'admin_actor 是內部 helper');
select is(
  (select count(*)::int from pg_policies
    where ('anon' = any(roles) or 'public' = any(roles))
      and (coalesce(qual, '') ~ '(is_admin|my_role)\(' or coalesce(with_check, '') ~ '(is_admin|my_role)\(')),
  0, '沒有任何 anon（或 PUBLIC）會套用的 policy 呼叫 is_admin／my_role');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select count(*)::int from public.creator_profiles where handle like 'admtest%'),
  1, '訪客只看得到已審核的創作者（而且不會 permission denied）');
select is(
  (select count(*)::int from public.creator_portfolio_items
    where creator_id in ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000000a13')),
  1, '訪客只看得到已審核創作者的作品');
reset role;

-- ===== 2. set_creator_status =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a01","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a11', 'approve')$$,
  '42501', 'not admin', '品牌不能審核');
select throws_ok(
  $$select * from public.admin_list_creators('pending', null, 50, 0)$$,
  '42501', 'not admin', '品牌不能看審核列表');
select is(
  (select count(*)::int from public.creator_profiles where handle in ('admtest_one', 'admtest_two')),
  0, '品牌看不到待審核的創作者');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a19","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.admin_list_creators('pending', 'admtest', 50, 0)),
  2, '管理員看得到待審核列表');
select is(
  (select total_count::int from public.admin_list_creators('pending', 'admtest', 1, 0) limit 1),
  2, 'total_count 是篩選後的總數（不受 limit 影響）');
select is(
  (select handle from public.admin_list_creators('pending', 'admtest', 1, 0) limit 1),
  'admtest_one', '待審核依申請時間由舊到新（同時間依 id）');
select is(
  (select verification_code from public.admin_list_creators('pending', 'admtest_one', 50, 0) limit 1),
  'ABCDEF', '列表帶出 IG 驗證碼');
select is(
  (select count(*)::int from public.admin_list_creators('all', '%', 50, 0)),
  0, '關鍵字的 % 照字面比對（不是萬用字元）');
select throws_ok(
  $$select * from public.admin_list_creators('bogus', null, 50, 0)$$,
  '22023', 'invalid status', '不認得的狀態');

select is(
  public.set_creator_status('00000000-0000-0000-0000-000000000a11', 'approve'),
  'approved', '管理員核准');
select ok(
  (select handle_locked_at is not null from public.creator_profiles where user_id = '00000000-0000-0000-0000-000000000a11'),
  '核准後鎖定 handle');
select is(
  (select actor_kind || ',' || actor_id::text || ',' || coalesce(collaboration_id::text, 'null')
     from public.audit_logs
    where subject_id = '00000000-0000-0000-0000-000000000a11' and action = 'creator_approve'),
  'admin,00000000-0000-0000-0000-000000000a19,null', 'audit：actor 是管理員、沒有合作案');
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a12', 'reject', '  ')$$,
  '22023', 'invalid reason', '退回要寫原因');
select is(
  public.set_creator_status('00000000-0000-0000-0000-000000000a12', 'reject', '自我介紹裡找不到驗證碼'),
  'rejected', '管理員退回');
select ok(
  (select handle_locked_at is null and review_note = '自我介紹裡找不到驗證碼'
     from public.creator_profiles where user_id = '00000000-0000-0000-0000-000000000a12'),
  '退回不鎖 handle，原因寫在 review_note');
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a11', 'reject', 'x')$$,
  '55000', 'creator status changed', '已審核的不能退回');
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a11', 'delete')$$,
  '22023', 'invalid action', '不認得的動作');
select throws_ok(
  $$select public.set_creator_status('00000000-0000-0000-0000-000000000a01', 'approve')$$,
  'P0002', 'creator not found', '不是創作者');
select is(
  public.set_creator_status('00000000-0000-0000-0000-000000000a13', 'suspend', '多次私下交易'),
  'suspended', '停權');
select is(
  public.set_creator_status('00000000-0000-0000-0000-000000000a13', 'unsuspend'),
  'approved', '解除停權');
select ok(
  (select review_note is null from public.creator_profiles where user_id = '00000000-0000-0000-0000-000000000a13'),
  '解除停權後清掉原因');

-- ===== 3. 創作者看得到自己的原因、重新送審 =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a12","role":"authenticated"}', true);
select is(
  (select review_note from public.creator_profiles where user_id = '00000000-0000-0000-0000-000000000a12'),
  '自我介紹裡找不到驗證碼', '創作者看得到自己的退回原因');
select is(
  (select count(*)::int from public.audit_logs where subject_id = '00000000-0000-0000-0000-000000000a12'),
  0, '沒有合作案的 audit 只有管理員看得到');
select lives_ok($$select public.request_creator_review()$$, '退回後可以重新送審');
select ok(
  (select status = 'pending' and review_note is null
     from public.creator_profiles where user_id = '00000000-0000-0000-0000-000000000a12'),
  '回到待審核、清掉原因');
select throws_ok($$select public.request_creator_review()$$, '55000', 'creator status changed', '不是退回狀態不能送審');
select throws_ok(
  $$update public.creator_profiles set review_note = null where user_id = '00000000-0000-0000-0000-000000000a12'$$,
  '42501', null, '創作者不能直接改 review_note');
reset role;

-- service_role（README 備用 SQL）：actor 是 system
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.set_creator_status('00000000-0000-0000-0000-000000000a12', 'approve'),
  'approved', 'service_role 也可以審核（備用 SQL）');
reset role;
select is(
  (select actor_kind || ',' || coalesce(actor_id::text, 'null') from public.audit_logs
    where subject_id = '00000000-0000-0000-0000-000000000a12' and action = 'creator_approve'),
  'system,null', 'service_role 的 audit 是 system');
select throws_ok(
  $$update public.creator_profiles set review_note = 'x' where user_id = '00000000-0000-0000-0000-000000000a12'$$,
  '23514', null, '已審核的不能有 review_note');

-- ===== 4. 違規訊息 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a01","role":"authenticated"}', true);
select throws_ok(
  $$select public.mark_message_reviewed('00000000-0000-0000-0000-00000000ab01')$$,
  '42501', 'not admin', '品牌不能標記');
select is((select count(*)::int from public.message_reviews), 0, '品牌讀不到檢視紀錄');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a19","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.admin_list_flagged_messages('open', 100, 0)
    where conversation_id = '00000000-0000-0000-0000-00000000aa01'),
  1, '未檢視列表只有含聯絡方式的訊息');
select is(
  (select sender_side || ',' || creator_handle from public.admin_list_flagged_messages('open', 100, 0)
    where id = '00000000-0000-0000-0000-00000000ab01'),
  'brand,admtest_three', '列表帶出發送方與雙方');
select is(public.mark_message_reviewed('00000000-0000-0000-0000-00000000ab01'), true, '標記已檢視');
select is(public.mark_message_reviewed('00000000-0000-0000-0000-00000000ab01'), false, '重複標記不報錯');
select throws_ok(
  $$select public.mark_message_reviewed('00000000-0000-0000-0000-00000000ab02')$$,
  '22023', 'message not flagged', '一般訊息不能標記');
select throws_ok(
  $$select public.mark_message_reviewed('00000000-0000-0000-0000-00000000abff')$$,
  'P0002', 'message not found', '找不到訊息');
select is(
  (select count(*)::int from public.admin_list_flagged_messages('reviewed', 100, 0)
    where id = '00000000-0000-0000-0000-00000000ab01'),
  1, '標記後移到已檢視');
select is(
  (select count(*)::int from public.audit_logs
    where action = 'message_reviewed' and subject_id = '00000000-0000-0000-0000-000000000a01'),
  1, 'audit 只記第一次，subject 是發送者');

select * from finish();
rollback;
