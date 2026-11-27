-- 評價：20261202000100_reviews.sql。id 前綴 …0000000e2xxx，handle rvtest_*。
begin;
create extension if not exists pgtap with schema extensions;
select plan(64);

-- e2001 品牌、e2002 沒有關係的品牌、e2003 同時是管理員的品牌；e2011 已審核創作者、e2012 未審核創作者；e2099 管理員
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e2001', 'rv-b1@test.local'),
  ('00000000-0000-0000-0000-0000000e2002', 'rv-b2@test.local'),
  ('00000000-0000-0000-0000-0000000e2003', 'rv-b3@test.local'),
  ('00000000-0000-0000-0000-0000000e2011', 'rv-c1@test.local'),
  ('00000000-0000-0000-0000-0000000e2012', 'rv-c2@test.local'),
  ('00000000-0000-0000-0000-0000000e2099', 'rv-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000e2001', 'brand', '評價品牌'),
  ('00000000-0000-0000-0000-0000000e2002', 'brand', '路過品牌'),
  ('00000000-0000-0000-0000-0000000e2003', 'brand', '管理員品牌'),
  ('00000000-0000-0000-0000-0000000e2011', 'creator', '評價創作者'),
  ('00000000-0000-0000-0000-0000000e2012', 'creator', '未審核創作者');
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-0000000e2003'), ('00000000-0000-0000-0000-0000000e2099');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000e2001', '評價品牌'),
  ('00000000-0000-0000-0000-0000000e2002', '路過品牌'),
  ('00000000-0000-0000-0000-0000000e2003', '管理員品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000e2011', 'rvtest_one', 'rvtest_one', 'approved'),
  ('00000000-0000-0000-0000-0000000e2012', 'rvtest_two', 'rvtest_two', 'pending');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000000e2d01', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2011'),
  ('00000000-0000-0000-0000-0000000e2d02', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2012'),
  ('00000000-0000-0000-0000-0000000e2d03', '00000000-0000-0000-0000-0000000e2003', '00000000-0000-0000-0000-0000000e2011');
-- c01 剛完成（雙方都會寫）、c02 待撥款（還不能寫）、c03 完成 20 天（期限已過）、c04 剛完成（只有品牌寫）、
-- c05 剛完成、創作者未審核、c06 剛完成、品牌是管理員
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
values
  ('00000000-0000-0000-0000-0000000e2c01', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2011',
   '00000000-0000-0000-0000-0000000e2d01', '評價一', 'x', 5000, 'completed'),
  ('00000000-0000-0000-0000-0000000e2c02', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2011',
   '00000000-0000-0000-0000-0000000e2d01', '評價二', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-0000000e2c03', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2011',
   '00000000-0000-0000-0000-0000000e2d01', '評價三', 'x', 5000, 'awaiting_payout'),
  ('00000000-0000-0000-0000-0000000e2c04', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2011',
   '00000000-0000-0000-0000-0000000e2d01', '評價四', 'x', 5000, 'completed'),
  ('00000000-0000-0000-0000-0000000e2c05', '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2012',
   '00000000-0000-0000-0000-0000000e2d02', '評價五', 'x', 5000, 'completed'),
  ('00000000-0000-0000-0000-0000000e2c06', '00000000-0000-0000-0000-0000000e2003', '00000000-0000-0000-0000-0000000e2011',
   '00000000-0000-0000-0000-0000000e2d03', '評價六', 'x', 5000, 'completed');
-- c03：20 天前完成（直接改狀態，再補一筆當時的 audit）
select set_config('kollink.in_transition', 'on', true);
update public.collaborations set status = 'completed' where id = '00000000-0000-0000-0000-0000000e2c03';
select set_config('kollink.in_transition', 'off', true);
insert into public.audit_logs (collaboration_id, actor_kind, action, from_status, to_status, created_at) values
  ('00000000-0000-0000-0000-0000000e2c03', 'system', 'payout', 'awaiting_payout', 'completed', now() - interval '20 days');

-- ── 權限 ──
select ok(not has_table_privilege('anon', 'public.collaboration_reviews', 'SELECT'), 'anon 不能直接讀評價表');
select ok(not has_table_privilege('authenticated', 'public.collaboration_reviews', 'SELECT'), 'authenticated 不能直接讀評價表');
select ok(not has_table_privilege('authenticated', 'public.collaboration_reviews', 'INSERT'), 'authenticated 不能直接寫評價表');
select ok(not has_table_privilege('service_role', 'public.collaboration_reviews', 'SELECT'), 'service_role 不能直接讀評價表');
select ok(not has_function_privilege('anon', 'public.submit_collaboration_review(uuid, integer, text)', 'EXECUTE'), 'anon 不能送出評價');
select ok(has_function_privilege('authenticated', 'public.submit_collaboration_review(uuid, integer, text)', 'EXECUTE'), 'authenticated 可以送出評價');
select ok(not has_function_privilege('anon', 'public.get_collaboration_reviews(uuid)', 'EXECUTE'), 'anon 不能讀合作案的評價');
select ok(has_function_privilege('anon', 'public.review_stats(uuid[])', 'EXECUTE'), 'anon 可以讀評分統計');
select ok(has_function_privilege('anon', 'public.list_creator_reviews(uuid, integer, integer)', 'EXECUTE'), 'anon 可以讀創作者的評價');
select ok(not has_function_privilege('anon', 'public.admin_set_review_hidden(uuid, boolean, text)', 'EXECUTE'), 'anon 不能隱藏評價');
select ok(not has_function_privilege('authenticated', 'public.collab_completed_at(uuid)', 'EXECUTE'), '內部 helper 不開放');

set local role authenticated;

-- ── 送出：身分與狀態 ──
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5)$$, '42501', 'not authenticated', '沒有 uid 時拒絕');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2002","role":"authenticated"}', true);
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5)$$, 'P0002', 'collaboration not found', '不是參與者不能評價');
select is((select count(*)::int from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')), 0, '不是參與者讀不到評價區');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2001","role":"authenticated"}', true);
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2cff', 5)$$, 'P0002', 'collaboration not found', '不存在的合作案');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c02', 5)$$, '55000', 'collaboration not completed', '還沒完成不能評價');
select is((select count(*)::int from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c02')), 0, '還沒完成沒有評價區');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c03', 5)$$, '55000', 'review window closed', '超過 14 天不能評價');
select is((select can_review from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c03')), false, '超過期限：can_review = false');

-- ── 送出：格式 ──
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 0)$$, '22023', 'invalid rating', '0 星');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 6)$$, '22023', 'invalid rating', '6 星');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', null)$$, '22023', 'invalid rating', '沒有星數');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5, repeat('好', 501))$$, '22023', 'invalid comment', '超過 500 字');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5, E'很好‮')$$, '22023', 'invalid comment', '雙向控制字元');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5, '私下找我 someone@example.com')$$, '22023', 'comment has contact info', '不能留聯絡方式');

-- ── 雙盲：品牌先寫 ──
select is((select can_review from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')), true, '完成後可以評價');
select lives_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 4, '  準時交稿，溝通順利  ')$$, '品牌送出評價');
select throws_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5)$$, '55000', 'already reviewed', '不能寫第二次');
select results_eq(
  $$select can_review, my_rating, my_comment, their_submitted, their_published from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')$$,
  $$values (false, 4, '準時交稿，溝通順利', false, false)$$, '品牌看到自己的評價（文字已去頭尾空白），對方還沒寫');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2011","role":"authenticated"}', true);
select results_eq(
  $$select can_review, my_rating, their_submitted, their_published, their_rating, their_comment from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')$$,
  $$values (true, null::integer, true, false, null::integer, null::text)$$, '創作者只知道品牌寫了，看不到內容');
select is((select count(*)::int from public.list_creator_reviews('00000000-0000-0000-0000-0000000e2011')), 0, '還沒公開：公開頁沒有這則');
select is((select review_count from public.review_stats(array['00000000-0000-0000-0000-0000000e2011']::uuid[])), 0, '還沒公開：不列入則數');
select is((select avg_rating from public.review_stats(array['00000000-0000-0000-0000-0000000e2011']::uuid[])), null, '沒有公開的評價：平均是 null');

-- ── 創作者也寫：兩則一起公開 ──
select lives_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c01', 5)$$, '創作者送出評價（沒有文字）');
select results_eq(
  $$select can_review, my_rating, my_comment, their_published, their_rating, their_comment from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')$$,
  $$values (false, 5, null::text, true, 4, '準時交稿，溝通順利')$$, '雙方都寫完：創作者看到品牌的評價');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2001","role":"authenticated"}', true);
select results_eq(
  $$select their_published, their_rating from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')$$,
  $$values (true, 5)$$, '雙方都寫完：品牌看到創作者的評價');

-- ── 只有一方寫：期滿才公開 ──
select lives_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c04', 2, '晚了三天')$$, '品牌評價第四案');
reset role;
select ok((select visible_from > now() + interval '13 days' from public.collaboration_reviews where collaboration_id = '00000000-0000-0000-0000-0000000e2c04'),
  '只有一方寫：公開時間是期限（14 天後）');
set local role authenticated;

-- ── 公開頁與統計 ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq(
  $$select rating, comment, brand_name from public.list_creator_reviews('00000000-0000-0000-0000-0000000e2011')$$,
  $$values (4, '準時交稿，溝通順利', '評價品牌')$$, '訪客看到已公開的評價（沒公開的第四案不在內）');
select results_eq(
  $$select avg_rating, review_count, completed_count from public.review_stats(array['00000000-0000-0000-0000-0000000e2011']::uuid[])$$,
  $$values (4.0::numeric, 1, 4)$$, '訪客看到創作者的統計：平均 4.0、1 則、完成 4 案');
select is((select count(*)::int from public.review_stats(array['00000000-0000-0000-0000-0000000e2001']::uuid[])), 0, '訪客查不到品牌的統計');
select is((select count(*)::int from public.review_stats(array['00000000-0000-0000-0000-0000000e2012']::uuid[])), 0, '訪客查不到未審核創作者的統計');
select is((select count(*)::int from public.list_creator_reviews('00000000-0000-0000-0000-0000000e2012')), 0, '訪客看不到未審核創作者的評價');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2002","role":"authenticated"}', true);
select results_eq(
  $$select avg_rating, review_count from public.review_stats(array['00000000-0000-0000-0000-0000000e2001']::uuid[])$$,
  $$values (5.0::numeric, 1)$$, '登入的人看得到品牌的統計（創作者給的 5 星）');
select is((select count(*)::int from public.review_stats(array['00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2011', '00000000-0000-0000-0000-0000000e2012', '00000000-0000-0000-0000-0000000e2fff']::uuid[])), 2,
  '一次查多個：未審核與不存在的不回傳');
select is((select count(*)::int from public.list_creator_reviews('00000000-0000-0000-0000-0000000e2001')), 0, '品牌沒有公開的評價列表');

-- 未審核創作者：本人看得到自己的
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2001","role":"authenticated"}', true);
select lives_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c05', 3)$$, '品牌評價未審核創作者');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2012","role":"authenticated"}', true);
select lives_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c05', 4)$$, '未審核創作者也能評價');
select is((select count(*)::int from public.list_creator_reviews('00000000-0000-0000-0000-0000000e2012')), 1, '未審核創作者看得到自己的評價');
select is((select review_count from public.review_stats(array['00000000-0000-0000-0000-0000000e2012']::uuid[])), 1, '未審核創作者看得到自己的統計');

-- ── 管理員 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2001","role":"authenticated"}', true);
select throws_ok($$select * from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c01')$$, '42501', 'not admin', '一般使用者不能用管理員列表');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2099","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select * from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c01')$$, '42501', 'not admin', '沒有通過兩步驟驗證的管理員不行');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2099","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c01')), 2, '管理員看到兩則');
select throws_ok($$select public.admin_set_review_hidden('00000000-0000-0000-0000-0000000e2fff', true, '違規')$$, 'P0002', 'review not found', '不存在的評價');
select throws_ok(
  $$select public.admin_set_review_hidden((select id from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c01') where author_side = 'brand'), true, '  ')$$,
  '22023', 'invalid reason', '原因必填');
select is(
  (select public.admin_set_review_hidden((select id from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c01') where author_side = 'brand'), true, '人身攻擊')),
  true, '管理員隱藏品牌的評價');
select is(
  (select public.admin_set_review_hidden((select id from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c01') where author_side = 'brand'), true, '人身攻擊')),
  false, '重複隱藏回傳 false');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'review_hidden' and subject_id = '00000000-0000-0000-0000-0000000e2011' and collaboration_id is null), 1,
  '隱藏寫一筆 audit（重複的不寫）');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2011","role":"authenticated"}', true);
select results_eq(
  $$select their_submitted, their_published, their_rating from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')$$,
  $$values (true, false, null::integer)$$, '被隱藏的評價對方看不到內容');
select is((select count(*)::int from public.list_creator_reviews('00000000-0000-0000-0000-0000000e2011')), 0, '被隱藏的評價不在公開頁');
select is((select review_count from public.review_stats(array['00000000-0000-0000-0000-0000000e2011']::uuid[])), 0, '被隱藏的評價不列入統計');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2001","role":"authenticated"}', true);
select results_eq(
  $$select my_rating, my_hidden from public.get_collaboration_reviews('00000000-0000-0000-0000-0000000e2c01')$$,
  $$values (4, true)$$, '作者看得到自己被隱藏的評價');

-- 管理員是參與者：不能處理自己合作案的評價
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2011","role":"authenticated"}', true);
select lives_ok($$select public.submit_collaboration_review('00000000-0000-0000-0000-0000000e2c06', 1, '態度很差')$$, '創作者評價管理員的品牌');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e2003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.admin_set_review_hidden((select id from public.admin_list_collab_reviews('00000000-0000-0000-0000-0000000e2c06')), true, '不實')$$,
  '42501', 'admin is participant', '管理員不能隱藏別人對自己的評價');

select * from finish();
rollback;
