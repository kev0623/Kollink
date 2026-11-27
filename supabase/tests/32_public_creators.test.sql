-- 公開的創作者列表：20261203000100_public_creators.sql。id 前綴 …0000000e3xxx，handle pubtest_*。
-- 本機資料庫可能有其他創作者：斷言一律用關鍵字 pubtest 過濾。
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- e3001 品牌；e3011 美妝／台北（1 萬粉、有評價 5 星）、e3012 美食／高雄（5 萬粉）、e3013 美妝／高雄（3 千粉、評價被隱藏）、
-- e3014 未審核、e3015 停權
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000e30' || n)::uuid, 'pub-' || n || '@test.local' from unnest(array['01','11','12','13','14','15']) n;
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000e3001', 'brand', '列表品牌'),
  ('00000000-0000-0000-0000-0000000e3011', 'creator', '列表甲'),
  ('00000000-0000-0000-0000-0000000e3012', 'creator', '列表乙 100%'),
  ('00000000-0000-0000-0000-0000000e3013', 'creator', '列表丙'),
  ('00000000-0000-0000-0000-0000000e3014', 'creator', '列表丁'),
  ('00000000-0000-0000-0000-0000000e3015', 'creator', '列表戊');
insert into public.brand_profiles (user_id, brand_name) values ('00000000-0000-0000-0000-0000000e3001', '列表品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status, categories, region, follower_count, created_at) values
  ('00000000-0000-0000-0000-0000000e3011', 'pubtest_a', 'pubtest_a', 'approved', array['美妝'], '台北市', 10000, timestamptz '2026-01-01'),
  ('00000000-0000-0000-0000-0000000e3012', 'pubtest_b', 'pubtest_b', 'approved', array['美食'], '高雄市', 50000, timestamptz '2026-01-02'),
  ('00000000-0000-0000-0000-0000000e3013', 'pubtest_c', 'pubtest_c', 'approved', array['美妝', '保養'], '高雄市', 3000, timestamptz '2026-01-03'),
  ('00000000-0000-0000-0000-0000000e3014', 'pubtest_d', 'pubtest_d', 'pending', array['美妝'], '台北市', 99999, timestamptz '2026-01-04'),
  ('00000000-0000-0000-0000-0000000e3015', 'pubtest_e', 'pubtest_e', 'suspended', array['美妝'], '台北市', 99999, timestamptz '2026-01-05');
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-0000000e3011', '00000000-0000-0000-0000-0000000e3011/portfolio-p2.jpg', 2),
  ('00000000-0000-0000-0000-0000000e3011', '00000000-0000-0000-0000-0000000e3011/portfolio-p1.jpg', 1);
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-0000000e3d01', '00000000-0000-0000-0000-0000000e3001', '00000000-0000-0000-0000-0000000e3011'),
  ('00000000-0000-0000-0000-0000000e3d02', '00000000-0000-0000-0000-0000000e3001', '00000000-0000-0000-0000-0000000e3013');
insert into public.collaborations (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status) values
  ('00000000-0000-0000-0000-0000000e3c01', '00000000-0000-0000-0000-0000000e3001', '00000000-0000-0000-0000-0000000e3011', '00000000-0000-0000-0000-0000000e3d01', '列表一', 'x', 5000, 'completed'),
  ('00000000-0000-0000-0000-0000000e3c02', '00000000-0000-0000-0000-0000000e3001', '00000000-0000-0000-0000-0000000e3013', '00000000-0000-0000-0000-0000000e3d02', '列表二', 'x', 5000, 'completed');
insert into public.collaboration_reviews (collaboration_id, author_id, subject_id, author_side, rating, visible_from, hidden_at) values
  ('00000000-0000-0000-0000-0000000e3c01', '00000000-0000-0000-0000-0000000e3001', '00000000-0000-0000-0000-0000000e3011', 'brand', 5, now() - interval '1 day', null),
  ('00000000-0000-0000-0000-0000000e3c02', '00000000-0000-0000-0000-0000000e3001', '00000000-0000-0000-0000-0000000e3013', 'brand', 1, now() - interval '1 day', now());

select ok(has_function_privilege('anon', 'public.list_public_creators(text, text, text, text, integer, integer)', 'EXECUTE'), 'anon 可以呼叫');
select ok(has_function_privilege('authenticated', 'public.list_public_creators(text, text, text, text, integer, integer)', 'EXECUTE'), 'authenticated 可以呼叫');
select ok(not has_function_privilege('service_role', 'public.list_public_creators(text, text, text, text, integer, integer)', 'EXECUTE'), 'service_role 不能呼叫');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq(
  $$select handle from public.list_public_creators('pubtest')$$,
  $$values ('pubtest_c'), ('pubtest_b'), ('pubtest_a')$$, '只列已審核的，預設新的在前（未審核與停權不列）');
select is((select total_count::int from public.list_public_creators('pubtest') limit 1), 3, 'total_count 是符合條件的總數');
select results_eq(
  $$select handle from public.list_public_creators('pubtest', null, null, 'followers')$$,
  $$values ('pubtest_b'), ('pubtest_a'), ('pubtest_c')$$, '依粉絲數排序');
select results_eq(
  $$select handle from public.list_public_creators('pubtest', null, null, 'rating')$$,
  $$values ('pubtest_a'), ('pubtest_c'), ('pubtest_b')$$, '依評價排序：有評價的在前，其餘照新舊');
select results_eq(
  $$select handle from public.list_public_creators('pubtest', null, null, 'drop table')$$,
  $$values ('pubtest_c'), ('pubtest_b'), ('pubtest_a')$$, '不認得的排序當成最新');
select results_eq(
  $$select handle from public.list_public_creators('pubtest', '美妝')$$,
  $$values ('pubtest_c'), ('pubtest_a')$$, '類別篩選');
select results_eq(
  $$select handle from public.list_public_creators('pubtest', '美妝', '高雄市')$$,
  $$values ('pubtest_c')$$, '類別＋地區');
select is((select count(*)::int from public.list_public_creators('pubtest', '不存在的類別')), 0, '清單以外的類別比對不到、不報錯');
select results_eq(
  $$select handle from public.list_public_creators('  列表甲 ')$$,
  $$values ('pubtest_a')$$, '用名稱搜尋（去頭尾空白）');
select results_eq(
  $$select handle from public.list_public_creators('100%')$$,
  $$values ('pubtest_b')$$, '% 照字面比對');
select is((select count(*)::int from public.list_public_creators('pubtest_')), 3, '_ 照字面比對（handle 都含 pubtest_）');
select results_eq(
  $$select avg_rating, review_count, cover_path from public.list_public_creators('pubtest_a')$$,
  $$values (5.0::numeric, 1, '00000000-0000-0000-0000-0000000e3011/portfolio-p1.jpg')$$, '帶出評分與第一張作品');
select results_eq(
  $$select avg_rating, review_count from public.list_public_creators('pubtest_c')$$,
  $$values (null::numeric, 0)$$, '被隱藏的評價不列入');
select results_eq(
  $$select handle from public.list_public_creators('pubtest', null, null, 'newest', 1, 1)$$,
  $$values ('pubtest_b')$$, '分頁');
select is((select count(*)::int from public.list_public_creators('pubtest', null, null, 'newest', -5, -5)), 1, 'limit 與 offset 夾在範圍內（最少 1 筆、從頭）');
select is((select count(*)::int from public.list_public_creators(repeat('x', 300))), 0, '超長關鍵字截斷後照常查詢');

select * from finish();
rollback;
