begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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

select * from finish();
rollback;
