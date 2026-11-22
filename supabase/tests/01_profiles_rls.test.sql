begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- 測試資料（以 postgres 身分建立，不受 RLS 限制）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');

insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'brand', '花粉選物'),
  ('00000000-0000-0000-0000-0000000000c1', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000c2', 'creator', '阿明');

insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000b1', '花粉選物');

insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-0000000000c1', 'mei', 'mei.ig', 'approved'),
  ('00000000-0000-0000-0000-0000000000c2', 'ming', 'ming.ig', 'pending');

insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-0000000000c1', 'ig_post', 4500);

-- 未登入訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.creator_profiles), 1,
  '訪客只看得到已審核通過的創作者');
select is((select count(*)::int from public.creator_rates), 0,
  '訪客看不到報價');

-- 品牌 b1
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is((select count(*)::int from public.creator_rates), 1,
  '品牌看得到報價');

-- 創作者 c2（尚未審核）
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

select is((select count(*)::int from public.creator_rates), 0,
  '創作者看不到其他創作者的報價');
select is(
  (select count(*)::int from public.creator_profiles
     where user_id = '00000000-0000-0000-0000-0000000000c2'),
  1, '創作者看得到自己尚未審核的檔案');
select throws_ok(
  $$update public.creator_profiles set status = 'approved' where user_id = auth.uid()$$,
  '42501', null, '創作者不能自己把狀態改成已審核');
select throws_ok(
  $$update public.profiles set role = 'brand' where id = auth.uid()$$,
  '42501', null, '使用者不能更改自己的身分');

select * from finish();
rollback;
