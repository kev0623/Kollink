begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', 'brand', '森林寵物食堂'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000b2', '森林寵物食堂');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved');

insert into public.briefs
  (id, brand_id, title, description, collab_types, includes_product, deadline, status, published_at) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b1',
   '春季新品開箱', 'IG 貼文 + 限動', array['IG 貼文'], true, public.today_tw() + 7, 'open', now()),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000b1',
   '已截止的招募', '舊案', array['IG 貼文'], true, public.today_tw() - 1, 'closed', now());

insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000000a001',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
insert into public.messages (conversation_id, sender_id, body) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b1', '您好，想邀請您合作');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.briefs$$, '42501', null, '訪客讀不到招募（計畫 5 收回 anon 權限）');

-- 品牌 b2（第三方）
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 0, '第三方看不到別人的訊息');
select is((select count(*)::int from public.conversations), 0, '第三方看不到別人的對話');
select is((select count(*)::int from public.briefs), 0, '品牌看不到其他品牌的招募（計畫 5）');
select throws_ok(
  $$insert into public.messages (conversation_id, body)
    values ('00000000-0000-0000-0000-00000000a001', '插話')$$,
  '42501', null, '第三方不能在別人的對話裡發訊息');

-- 創作者 c1
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 1, '對話參與者看得到訊息');
select lives_ok(
  $$select public.send_message('00000000-0000-0000-0000-00000000a001', '謝謝，我有興趣！')$$,
  '對話參與者可以發訊息（計畫 7 起經由 send_message）');
select throws_ok(
  $$insert into public.messages (conversation_id, body, flagged_contact)
    values ('00000000-0000-0000-0000-00000000a001', 'x', false)$$,
  '42501', null, '使用者不能自己設定違規標記');
select lives_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000000f001', '我想報名')$$,
  '創作者可以報名開放中的招募（計畫 5 起經由 apply_to_brief）');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000000f002', '我想報名')$$,
  '55000', 'brief closed', '創作者不能報名已關閉的招募');

-- 品牌 b1（招募主）與 b2
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.brief_applications), 1, '招募主看得到報名');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.brief_applications), 0, '其他品牌看不到報名');

select * from finish();
rollback;
