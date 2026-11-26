begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- 821 品牌；831 創作者（品牌開啟的空對話）；832 創作者（合作案建立的對話，沒有訊息）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000821', 'p7f-b@test.local'),
  ('00000000-0000-0000-0000-000000000831', 'p7f-c1@test.local'),
  ('00000000-0000-0000-0000-000000000832', 'p7f-c2@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000821', 'brand', '七號末品牌'),
  ('00000000-0000-0000-0000-000000000831', 'creator', '七號末甲'),
  ('00000000-0000-0000-0000-000000000832', 'creator', '七號末乙');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000821', '七號末品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000831', 'p7f1', 'p7f1', 'approved'),
  ('00000000-0000-0000-0000-000000000832', 'p7f2', 'p7f2', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000008d001', '00000000-0000-0000-0000-000000000821', '00000000-0000-0000-0000-000000000831'),
  ('00000000-0000-0000-0000-00000008d002', '00000000-0000-0000-0000-000000000821', '00000000-0000-0000-0000-000000000832');
insert into public.collaborations (brand_id, creator_id, conversation_id, title, deliverables, amount_twd) values
  ('00000000-0000-0000-0000-000000000821', '00000000-0000-0000-0000-000000000832',
   '00000000-0000-0000-0000-00000008d002', '七號末合作', '一則貼文', 1000);

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000831","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008d001', '我先說')$$,
  'P0002', 'conversation not found', '創作者不能搶先在品牌開啟的空對話發訊息');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000821","role":"authenticated"}', true);
select lives_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008d001', '您好')$$,
  '品牌可以先發訊息');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000831","role":"authenticated"}', true);
select lives_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008d001', '您好，請說')$$,
  '品牌發過訊息後創作者可以回覆');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000832","role":"authenticated"}', true);
select lives_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008d002', '合作案開始')$$,
  '合作案建立的對話（還沒有訊息）創作者可以發訊息');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000821","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008d001', repeat('字', 32001))$$,
  '22023', 'invalid body', '過大的輸入先被擋下');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008d001', repeat('字', 2001))$$,
  '22023', 'invalid body', '超過 2000 字仍被擋');

select * from finish();
rollback;
