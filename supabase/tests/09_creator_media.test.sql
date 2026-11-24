begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.local'),  -- 品牌
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.local'),  -- 創作者
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test.local');  -- 還沒建立帳號
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'brand', '品牌A'),
  ('00000000-0000-0000-0000-0000000000a2', 'creator', '創作者A');

select is((select public from storage.buckets where id = 'creator-media'), true, 'bucket 是公開的');
select is((select file_size_limit from storage.buckets where id = 'creator-media'), 5242880::bigint, '檔案上限 5MB');
select is((select allowed_mime_types from storage.buckets where id = 'creator-media'),
  array['image/jpeg', 'image/png', 'image/webp'], '只接受 jpeg、png、webp');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/avatar-1.png')$$,
  '創作者可以上傳頭像到自己的資料夾');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/portfolio-1.jpg')$$,
  '創作者可以上傳作品到自己的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a1/avatar-1.png')$$,
  '42501', null, '不能上傳到別人的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/other-1.png')$$,
  '42501', null, '檔名必須以 avatar- 或 portfolio- 開頭');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/x/avatar-1.png')$$,
  '42501', null, '不能上傳到巢狀資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/avatar-..png')$$,
  '42501', null, '路徑不能含 ..');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a1/avatar-1.png')$$,
  '42501', null, '品牌不能上傳到 creator-media');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a3/avatar-1.png')$$,
  '42501', null, '還沒建立帳號的使用者不能上傳');

-- 別人不能刪除創作者的物件（RLS 讓該列不可見，影響 0 列）
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'creator-media' and name = '00000000-0000-0000-0000-0000000000a2/avatar-1.png'$$,
  '刪除別人的物件不報錯（影響 0 列）');
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'creator-media' and name = '00000000-0000-0000-0000-0000000000a2/avatar-1.png'),
  1, '別人的物件沒有被刪除');

set local role anon;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('creator-media', '00000000-0000-0000-0000-0000000000a2/avatar-2.png')$$,
  '42501', null, '未登入不能上傳');

select * from finish();
rollback;
