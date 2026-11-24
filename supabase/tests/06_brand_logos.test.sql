begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local'),  -- 品牌
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.local'),  -- 創作者
  ('00000000-0000-0000-0000-0000000000e3', 'e3@test.local');  -- 還沒建立帳號
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000e1', 'brand', '品牌E'),
  ('00000000-0000-0000-0000-0000000000e2', 'creator', '創作者E');

select is((select public from storage.buckets where id = 'brand-logos'), true, 'bucket 是公開的');
select is((select file_size_limit from storage.buckets where id = 'brand-logos'), 2097152::bigint, '檔案上限 2MB');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e1/logo.png')$$,
  '品牌可以上傳到自己的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e2/logo.png')$$,
  '42501', null, '不能上傳到別人的資料夾');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e2/logo.png')$$,
  '42501', null, '創作者不能上傳 Logo');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e3/logo.png')$$,
  '還沒建立帳號的使用者可以先上傳（品牌註冊流程）');

-- 檔名規則：巢狀資料夾、. 開頭、.. 都要擋
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e1/a/b.png')$$,
  '42501', null, '不能上傳到巢狀資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e1/.x.png')$$,
  '42501', null, '檔名不能以 . 開頭');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e1/../00000000-0000-0000-0000-0000000000e2/x.png')$$,
  '42501', null, '路徑不能含 ..');

-- 以 postgres 種下創作者資料夾內的物件
reset role;
insert into storage.objects (bucket_id, name, version) values
  ('brand-logos', '00000000-0000-0000-0000-0000000000e2/seed.png', 'v0');

-- 別的使用者不能改或刪品牌 E1 的物件（RLS 讓該列不可見，影響 0 列）
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}', true);
select lives_ok(
  $$update storage.objects set version = 'hacked' where bucket_id = 'brand-logos' and name = '00000000-0000-0000-0000-0000000000e1/logo.png'$$,
  '更新別人的物件不報錯（影響 0 列）');
-- storage 的 protect_delete trigger 預設禁止直接 DELETE；測試時暫時放行以驗證 RLS
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'brand-logos' and name = '00000000-0000-0000-0000-0000000000e1/logo.png'$$,
  '刪除別人的物件不報錯（影響 0 列）');
reset role;
select is(
  (select version from storage.objects where bucket_id = 'brand-logos' and name = '00000000-0000-0000-0000-0000000000e1/logo.png'),
  null::text, '別人的物件沒有被更新');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'brand-logos' and name = '00000000-0000-0000-0000-0000000000e1/logo.png'),
  1, '別人的物件沒有被刪除');

-- 創作者不能更新自己資料夾內已存在的物件
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select throws_ok(
  $$update storage.objects set version = 'v1' where bucket_id = 'brand-logos' and name = '00000000-0000-0000-0000-0000000000e2/seed.png'$$,
  '42501', null, '創作者不能更新自己資料夾的物件');

-- 未登入不能上傳
reset role;
set local role anon;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('brand-logos', '00000000-0000-0000-0000-0000000000e1/anon.png')$$,
  '42501', null, '未登入不能上傳');

select * from finish();
rollback;
