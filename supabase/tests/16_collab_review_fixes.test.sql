begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- 761 品牌、771 創作者；7b1 待交稿、7b2 到期審核中
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000761', 'p6f-b1@test.local'),
  ('00000000-0000-0000-0000-000000000771', 'p6f-c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000761', 'brand', '修正品牌'),
  ('00000000-0000-0000-0000-000000000771', 'creator', '修正創作者');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000761', '修正品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000771', 'p6fix', 'p6fix', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c061', '00000000-0000-0000-0000-000000000761', '00000000-0000-0000-0000-000000000771');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at) values
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-000000000761', '00000000-0000-0000-0000-000000000771',
   '00000000-0000-0000-0000-00000007c061', '待交稿', 'IG 貼文', 3000, 'awaiting_submission', null),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-000000000761', '00000000-0000-0000-0000-000000000771',
   '00000000-0000-0000-0000-00000007c061', '到期審核', 'IG 貼文', 3000, 'in_review', now() - interval '1 hour');

-- ── 1. 交稿只能經由 submit_deliverables ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000771","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-0000000007b1', 'submit')$$,
  '22023', null, '創作者不能直接呼叫 transition_collaboration(submit)');
select is(
  (select c.status::text || '|' || (select count(*) from public.collaboration_submissions s where s.collaboration_id = c.id)
     from public.collaborations c where c.id = '00000000-0000-0000-0000-0000000007b1'),
  'awaiting_submission|0', '直接 submit 被拒後狀態不變、沒有交稿紀錄');
select is(current_setting('kollink.submitting_deliverables', true) is distinct from 'on', true, '被拒後旗標沒有開著');
select is(
  public.submit_deliverables('00000000-0000-0000-0000-0000000007b1', null, array['https://drive.google.com/x'], '{}'),
  1, 'submit_deliverables 仍可交稿');
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007b1'),
  'in_review', '交稿後進入審核中');
select is(current_setting('kollink.submitting_deliverables', true), 'off', '交稿完成後旗標已關閉');

-- ── 2. check_collab_offer（RETURNS TABLE + use_column）──
reset role;
select is((select o.title || '|' || o.deliverables from public.check_collab_offer(' 案名 ', ' 內容 ', 100) o),
  '案名|內容', 'check_collab_offer 回傳清理後的文字');
select throws_ok($$select * from public.check_collab_offer('', 'x', 100)$$, '22023', 'invalid title', '空案名被拒');

-- ── 3. auto_approve_due（service_role、鎖列後仍回傳相同形狀）──
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select results_eq(
  $$select approved, cardinality(failed) from public.auto_approve_due()$$,
  $$values (1, 0)$$, 'auto_approve_due 通過 1 件、0 件失敗');
reset role;
select is(
  (select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007b2'),
  'awaiting_publish', '到期的審核中合作案已自動通過');

-- ── 4. storage helper 與 AND 順序無關：非 uuid 開頭的路徑回傳 false、不報錯 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000771","role":"authenticated"}', true);
select is(public.can_read_deliverable('zzzzzzzz-not-a-uuid/x/y.jpg'), false, 'can_read：非 uuid 路徑回傳 false');
select is(public.can_upload_deliverable('zzzzzzzz-not-a-uuid/x/y.jpg'), false, 'can_upload：非 uuid 路徑回傳 false');

select * from finish();
rollback;
