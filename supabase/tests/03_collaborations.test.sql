begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', 'brand', '森林寵物食堂'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000a1', 'brand', '平台管理員');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', '森林寵物食堂');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

-- ===== 品牌 b1 建立邀約 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.collaborations
      (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-00000000cc01',
            '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-00000000a001',
            '春季新品開箱', 'IG 貼文 1 篇 + 限動 2 則', 4500)$$,
  '品牌可以建立邀約');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01' and action = 'create'),
  1, '建立邀約會寫入 audit log');
select throws_ok(
  $$update public.collaborations set status = 'completed'
    where id = '00000000-0000-0000-0000-00000000cc01'$$,
  '42501', null, '不能直接改狀態欄位');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'approve')$$,
  '22023', null, '邀約階段不能審核通過');

-- ===== 創作者 c1 接受 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'accept'),
  'awaiting_payment'::public.collab_status, '創作者接受邀約');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'mark_paid')$$,
  '22023', null, '創作者不能自己標記已付款');

-- ===== 第三方品牌 b2 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.collaborations), 0, '第三方看不到別人的合作案');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'cancel')$$,
  '42501', null, '第三方不能操作別人的合作案');

-- ===== 系統（service role）標記已付款 =====
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'mark_paid'),
  'awaiting_submission'::public.collab_status, '系統標記已付款');

-- ===== 創作者交稿 =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'submit'),
  'in_review'::public.collab_status, '創作者交稿');
select ok(
  (select review_due_at > now() + interval '71 hours'
     from public.collaborations where id = '00000000-0000-0000-0000-00000000cc01'),
  '交稿後設定 3 天審核期限');

-- ===== 品牌要求修改 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes')$$,
  '22023', null, '要求修改必須填寫說明');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'request_changes',
                                  '第二張色調再亮一點'),
  'awaiting_submission'::public.collab_status, '品牌要求修改，退回交稿');

-- ===== 再次交稿、審核通過、發佈 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'submit'),
  'in_review'::public.collab_status, '創作者再次交稿');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'approve'),
  'awaiting_publish'::public.collab_status, '品牌審核通過');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish')$$,
  '22023', null, '發佈必須附上貼文連結');
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'publish', null,
                                  'https://www.instagram.com/p/abc123/'),
  'awaiting_payout'::public.collab_status, '創作者發佈');
select throws_ok(
  $$select public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'payout')$$,
  '22023', null, '創作者不能自己撥款');

-- ===== 管理員撥款 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-00000000cc01', 'payout'),
  'completed'::public.collab_status, '管理員撥款，結案');
select is(
  (select published_url from public.collaborations
     where id = '00000000-0000-0000-0000-00000000cc01'),
  'https://www.instagram.com/p/abc123/', '已記錄貼文連結');
select is(
  (select count(*)::int from public.audit_logs
     where collaboration_id = '00000000-0000-0000-0000-00000000cc01'),
  9, '每個成功的動作都留下一筆紀錄（create + 8 次轉換）');

-- ===== audit log 不能修改 =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$delete from public.audit_logs$$,
  '42501', null, '使用者不能刪除 audit log');

reset role;
select throws_ok(
  $$update public.audit_logs set note = 'tampered'$$,
  'P0001', null, '連資料庫擁有者也不能修改 audit log');

select * from finish();
rollback;
