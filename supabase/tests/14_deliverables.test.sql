begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- 721 品牌、722 別的品牌、731 創作者、739 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000721', 'p6d-b1@test.local'),
  ('00000000-0000-0000-0000-000000000722', 'p6d-b2@test.local'),
  ('00000000-0000-0000-0000-000000000731', 'p6d-c1@test.local'),
  ('00000000-0000-0000-0000-000000000739', 'p6d-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000721', 'brand', '交稿品牌'),
  ('00000000-0000-0000-0000-000000000722', 'brand', '旁觀品牌'),
  ('00000000-0000-0000-0000-000000000731', 'creator', '交稿創作者');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000739');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000721', '交稿品牌'),
  ('00000000-0000-0000-0000-000000000722', '旁觀品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000731', 'p6deliver', 'p6deliver', 'approved');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c021', '00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000731');
-- dd01 待交稿、dd02 審核中
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at) values
  ('00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000731',
   '00000000-0000-0000-0000-00000007c021', '待交稿', 'IG 貼文', 3000, 'awaiting_submission', null),
  ('00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-000000000721', '00000000-0000-0000-0000-000000000731',
   '00000000-0000-0000-0000-00000007c021', '審核中', 'IG 貼文', 3000, 'in_review', now() + interval '3 days');

select is((select public from storage.buckets where id = 'deliverables'), false, 'bucket 是私密的');
select is((select file_size_limit from storage.buckets where id = 'deliverables'), 52428800::bigint, '檔案上限 50MB');
select is((select allowed_mime_types from storage.buckets where id = 'deliverables'),
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf'],
  '只接受圖片、影片、PDF');

-- ── 上傳 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg')$$,
  '創作者可以上傳到自己的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111112.exe')$$,
  '42501', null, '副檔名不在清單裡');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d2/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111113.jpg')$$,
  '42501', null, '合作案不在待交稿時不能上傳');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000721/11111111-1111-4111-8111-111111111114.jpg')$$,
  '42501', null, '不能上傳到別人的資料夾');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/x/11111111-1111-4111-8111-111111111115.jpg')$$,
  '42501', null, '不能上傳到巢狀資料夾');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000721/11111111-1111-4111-8111-111111111116.jpg')$$,
  '42501', null, '品牌不能上傳');

-- ── 讀取 ──
-- 20261129000100_security_hardening.sql（L4）：品牌只讀得到已交出的檔案；交稿後讀得到的斷言在 28_security_hardening
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 0, '品牌讀不到還沒交出的檔案');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 0, '第三人讀不到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000739","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '管理員讀得到');

-- ── 交稿 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://drive.google.com/x'], '{}')$$,
  '42501', 'not collaboration creator', '品牌不能交稿');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722","role":"authenticated"}', true);
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://drive.google.com/x'], '{}')$$,
  'P0002', 'collaboration not found', '第三人看不到合作案');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', '只有說明', '{}', '{}')$$,
  '22023', 'empty submission', '檔案或連結至少一個');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, '{}',
    array['00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/99999999-9999-4999-8999-999999999999.jpg'])$$,
  '22023', 'invalid file_paths', '檔案必須已經上傳');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, '{}',
    array['00000000-0000-0000-0000-0000000007d2/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg'])$$,
  '22023', 'invalid file_paths', '檔案必須在這個合作案的資料夾');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['http://drive.google.com/x'], '{}')$$,
  '22023', 'invalid links', '連結必須是 https');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null,
    array['https://a.com/1', 'https://a.com/2', 'https://a.com/3', 'https://a.com/4', 'https://a.com/5', 'https://a.com/6'], '{}')$$,
  '22023', 'invalid links', '連結最多 5 個');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', repeat('字', 1001), array['https://a.com/1'], '{}')$$,
  '22023', 'invalid note', '說明最多 1000 字');
select is(
  public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', ' 初稿 ', array[' https://drive.google.com/x '],
    array['00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg']),
  1, '第一次交稿');
select is(
  (select c.status::text || '|' || s.note || '|' || s.links[1] from public.collaborations c
     join public.collaboration_submissions s on s.collaboration_id = c.id
    where c.id = '00000000-0000-0000-0000-0000000007d1'),
  'in_review|初稿|https://drive.google.com/x', '交稿紀錄已清理，合作案進入審核');
select throws_ok(
  $$select public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://a.com/1'], '{}')$$,
  '55000', 'collaboration not awaiting submission', '審核中不能再交稿');
select throws_ok(
  $$insert into public.collaboration_submissions (collaboration_id, round, links)
    values ('00000000-0000-0000-0000-0000000007d1', 9, array['https://a.com/1'])$$,
  '42501', null, '不能直接寫入交稿紀錄');

-- ── 刪除 ──
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$delete from storage.objects where bucket_id = 'deliverables'
     and name = '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/11111111-1111-4111-8111-111111111111.jpg'$$,
  '刪除已交出的檔案不報錯（RLS 讓影響 0 列）');
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '已交出的檔案沒有被刪');

-- 品牌要求修改 → 創作者再上傳、刪掉一個、再交一次
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select is(
  public.transition_collaboration('00000000-0000-0000-0000-0000000007d1', 'request_changes', '亮一點'),
  'awaiting_submission'::public.collab_status, '品牌要求修改');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/22222222-2222-4222-8222-222222222222.pdf')$$,
  '退回後可以再上傳');
select lives_ok(
  $$delete from storage.objects where bucket_id = 'deliverables'
     and name = '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/22222222-2222-4222-8222-222222222222.pdf'$$,
  '可以刪掉還沒交出的檔案');
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 1, '還沒交出的檔案已刪除');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731","role":"authenticated"}', true);
select is(
  public.submit_deliverables('00000000-0000-0000-0000-0000000007d1', null, array['https://drive.google.com/y'], '{}'),
  2, '第二次交稿的輪次是 2');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('deliverables',
    '00000000-0000-0000-0000-0000000007d1/00000000-0000-0000-0000-000000000731/33333333-3333-4333-8333-333333333333.jpg')$$,
  '42501', null, '交稿後（審核中）不能再上傳');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721","role":"authenticated"}', true);
select is((select count(*)::int from public.collaboration_submissions), 2, '品牌讀得到兩次交稿');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722","role":"authenticated"}', true);
select is((select count(*)::int from public.collaboration_submissions), 0, '第三人讀不到交稿紀錄');

select * from finish();
rollback;
