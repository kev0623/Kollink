-- 粉絲數與帳號連結登入後才顯示、完整報價公開：20261204000100_gate_followers.sql。id 前綴 …0000000e4xxx，handle gatetest_*。
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- e4001 品牌；e4011 已審核創作者（1 萬粉、兩筆報價、一件作品有連結）、e4012 已審核（5 萬粉）、e4013 未審核（有報價）
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000e40' || n)::uuid, 'gate-' || n || '@test.local' from unnest(array['01','11','12','13']) n;
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000e4001', 'brand', '門檻品牌'),
  ('00000000-0000-0000-0000-0000000e4011', 'creator', '門檻甲'),
  ('00000000-0000-0000-0000-0000000e4012', 'creator', '門檻乙'),
  ('00000000-0000-0000-0000-0000000e4013', 'creator', '門檻丙');
insert into public.brand_profiles (user_id, brand_name) values ('00000000-0000-0000-0000-0000000e4001', '門檻品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status, follower_count, created_at) values
  ('00000000-0000-0000-0000-0000000e4011', 'gatetest_a', 'secret_ig_zz', 'approved', 10000, timestamptz '2026-01-02'),
  ('00000000-0000-0000-0000-0000000e4012', 'gatetest_b', 'gatetest_b', 'approved', 50000, timestamptz '2026-01-01'),
  ('00000000-0000-0000-0000-0000000e4013', 'gatetest_c', 'gatetest_c', 'pending', 70000, timestamptz '2026-01-03');
insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-0000000e4011', 'IG 貼文', 8000),
  ('00000000-0000-0000-0000-0000000e4011', '限時動態', 3000),
  ('00000000-0000-0000-0000-0000000e4013', 'IG 貼文', 5000);
insert into public.creator_portfolio_items (creator_id, image_path, link_url, position) values
  ('00000000-0000-0000-0000-0000000e4011', '00000000-0000-0000-0000-0000000e4011/portfolio-a.jpg', 'https://www.instagram.com/p/abc123/', 1);

-- ── 權限 ──
select ok(not has_column_privilege('anon', 'public.creator_profiles', 'follower_count', 'SELECT'), 'anon 不能直接讀粉絲數');
select ok(not has_column_privilege('anon', 'public.creator_profiles', 'ig_username', 'SELECT'), 'anon 不能直接讀 IG 帳號');
select ok(not has_column_privilege('anon', 'public.creator_portfolio_items', 'link_url', 'SELECT'), 'anon 不能直接讀作品連結');
select ok(has_column_privilege('anon', 'public.creator_profiles', 'handle', 'SELECT')
          and has_column_privilege('anon', 'public.creator_portfolio_items', 'image_path', 'SELECT'), 'anon 仍可讀 handle 與作品圖');
select ok(has_column_privilege('authenticated', 'public.creator_profiles', 'follower_count', 'SELECT')
          and has_column_privilege('authenticated', 'public.creator_portfolio_items', 'link_url', 'SELECT'), '登入的人照舊讀得到');
select ok(has_function_privilege('anon', 'public.list_creator_rates(uuid)', 'EXECUTE'), 'anon 可以讀報價（經由函式）');
select ok(not has_function_privilege('service_role', 'public.list_creator_rates(uuid)', 'EXECUTE'), 'service_role 不能呼叫 list_creator_rates');

-- ── 訪客 ──
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select follower_count from public.get_public_creator('gatetest_a')), null, '訪客：公開頁沒有粉絲數');
select is((select display_name from public.get_public_creator('gatetest_a')), '門檻甲', '訪客：公開頁其他資料照常');
select results_eq(
  $$select handle, follower_count from public.list_public_creators('gatetest')$$,
  $$values ('gatetest_a', null::integer), ('gatetest_b', null::integer)$$, '訪客：列表沒有粉絲數（順序是最新）');
select results_eq(
  $$select handle from public.list_public_creators('gatetest', null, null, 'followers')$$,
  $$values ('gatetest_a'), ('gatetest_b')$$, '訪客：依粉絲數排序不生效');
select is((select count(*)::int from public.list_public_creators('secret_ig_zz')), 0, '訪客：不能用 IG 帳號搜尋');
select throws_ok($$select follower_count from public.creator_profiles limit 1$$, '42501', null, '訪客：直接讀粉絲數被拒');
select throws_ok($$select link_url from public.creator_portfolio_items limit 1$$, '42501', null, '訪客：直接讀作品連結被拒');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = '00000000-0000-0000-0000-0000000e4011'), 1, '訪客：仍然讀得到作品');
select results_eq(
  $$select collab_type, price_twd from public.list_creator_rates('00000000-0000-0000-0000-0000000e4011') order by price_twd$$,
  $$values ('限時動態', 3000), ('IG 貼文', 8000)$$, '訪客：看得到已審核創作者的完整報價');
select is((select count(*)::int from public.list_creator_rates('00000000-0000-0000-0000-0000000e4013')), 0, '訪客：看不到未審核創作者的報價');

-- ── 登入（另一位創作者）──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e4012","role":"authenticated"}', true);
select is((select follower_count from public.get_public_creator('gatetest_a')), 10000, '登入：公開頁有粉絲數');
select results_eq(
  $$select handle, follower_count from public.list_public_creators('gatetest', null, null, 'followers')$$,
  $$values ('gatetest_b', 50000), ('gatetest_a', 10000)$$, '登入：列表有粉絲數，可以依粉絲數排序');
select is((select handle from public.list_public_creators('secret_ig_zz')), 'gatetest_a', '登入：可以用 IG 帳號搜尋');
select is((select count(*)::int from public.list_creator_rates('00000000-0000-0000-0000-0000000e4011')), 2, '登入的創作者也看得到別人的報價');
-- 未審核創作者本人
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e4013","role":"authenticated"}', true);
select is((select count(*)::int from public.list_creator_rates('00000000-0000-0000-0000-0000000e4013')), 1, '未審核創作者看得到自己的報價');

select * from finish();
rollback;
