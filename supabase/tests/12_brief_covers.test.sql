begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006c1', 'cov-b1@test.local'),  -- 品牌
  ('00000000-0000-0000-0000-0000000006c2', 'cov-b2@test.local'),  -- 另一個品牌
  ('00000000-0000-0000-0000-0000000006c3', 'cov-c1@test.local'),  -- 創作者
  ('00000000-0000-0000-0000-0000000006c4', 'cov-none@test.local'); -- 還沒建立帳號
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000006c1', 'brand', '封面品牌'),
  ('00000000-0000-0000-0000-0000000006c2', 'brand', '封面品牌二'),
  ('00000000-0000-0000-0000-0000000006c3', 'creator', '封面創作者');

select is((select public from storage.buckets where id = 'brief-covers'), true, 'bucket 是公開的');
select is((select file_size_limit from storage.buckets where id = 'brief-covers'), 5242880::bigint, '檔案上限 5MB');
select is((select allowed_mime_types from storage.buckets where id = 'brief-covers'),
  array['image/jpeg', 'image/png', 'image/webp'], '只接受 jpeg、png、webp');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c1","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c1/cover-1.jpg')$$,
  '品牌可以上傳封面到自己的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c2/cover-1.jpg')$$,
  '42501', null, '不能上傳到別人的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c1/logo-1.jpg')$$,
  '42501', null, '檔名必須以 cover- 開頭');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c1/x/cover-1.jpg')$$,
  '42501', null, '不能上傳到巢狀資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c1/cover-..jpg')$$,
  '42501', null, '路徑不能含 ..');
select lives_ok(
  $$update storage.objects set name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'
     where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-1.jpg'$$,
  '品牌可以把自己的封面改成合法名稱');
select throws_ok(
  $$update storage.objects set name = '00000000-0000-0000-0000-0000000006c2/cover-9.jpg'
     where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'$$,
  '42501', null, '不能把自己的封面搬進別人的資料夾');
select throws_ok(
  $$update storage.objects set name = '00000000-0000-0000-0000-0000000006c1/other-2.jpg'
     where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'$$,
  '42501', null, '不能改名成不合規的前綴');

-- 創作者與還沒建立帳號的使用者不能上傳
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c3","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c3/cover-1.jpg')$$,
  '42501', null, '創作者不能上傳封面');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c4","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c4/cover-1.jpg')$$,
  '42501', null, '還沒建立帳號的使用者不能上傳封面');

-- 刪除：storage.protect_delete 會擋直接 DELETE，測試要設 allow_delete_query 才能走到 RLS
select set_config('storage.allow_delete_query', 'true', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c2","role":"authenticated"}', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'$$,
  '刪除別人的封面不報錯（RLS 讓影響 0 列）');
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'),
  1, '別的品牌的刪除沒有生效');
-- 以 superuser 在創作者資料夾放一個物件：創作者不能改、不能刪
insert into storage.objects (bucket_id, name) values ('brief-covers', '00000000-0000-0000-0000-0000000006c3/cover-1.jpg');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c3","role":"authenticated"}', true);
select throws_ok(
  $$update storage.objects set name = '00000000-0000-0000-0000-0000000006c3/cover-2.jpg'
     where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c3/cover-1.jpg'$$,
  '42501', null, '創作者不能更新 brief-covers 的物件');
select lives_ok(
  $$delete from storage.objects where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c3/cover-1.jpg'$$,
  '創作者刪除不報錯（RLS 讓影響 0 列）');
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c3/cover-1.jpg'),
  1, '創作者的刪除沒有生效');
-- 品牌刪除自己的封面成功
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c1","role":"authenticated"}', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'$$,
  '品牌可以刪除自己的封面');
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'brief-covers' and name = '00000000-0000-0000-0000-0000000006c1/cover-2.jpg'),
  0, '自己的封面已被刪除');

select * from finish();
rollback;
