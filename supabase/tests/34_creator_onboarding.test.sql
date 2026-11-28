-- 創作者註冊流程：20261205000100_creator_onboarding.sql。id 前綴 …0000000f4xxx，handle obtest_*。
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000f40' || n)::uuid, 'ob-' || n || '@test.local' from unnest(array['01','02','03']) n;

select ok(not has_function_privilege('anon', 'public.handle_available(text)', 'EXECUTE'), 'anon 不能查網址');
select ok(has_function_privilege('authenticated', 'public.handle_available(text)', 'EXECUTE'), 'authenticated 可以查網址');
select ok(not has_function_privilege('anon', 'public.create_creator_with_rates(text, text, text, integer, text, text[], jsonb)', 'EXECUTE'), 'anon 不能建立');
select ok(not has_function_privilege('service_role', 'public.create_creator_with_rates(text, text, text, integer, text, text[], jsonb)', 'EXECUTE'), 'service_role 不能建立');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000f4001","role":"authenticated"}', true);

select ok(public.handle_available('obtest_a'), '沒人用的網址可以用');
select ok(not public.handle_available('ab'), '太短不行');
select ok(not public.handle_available('Obtest_A'), '大寫不行');
select ok(not public.handle_available(null), 'null 不行');

select throws_ok($$select public.create_creator_with_rates('甲', 'obtest_a', 'obtest_a', 100, '台北市', array['美妝'], '[]'::jsonb)$$,
  '22023', 'invalid rates', '至少要一筆報價');
select throws_ok($$select public.create_creator_with_rates('甲', 'obtest_a', 'obtest_a', 100, '台北市', array['美妝'], null)$$,
  '22023', 'invalid rates', '報價不能是 null');
select throws_ok($$select public.create_creator_with_rates('甲', 'obtest_a', 'obtest_a', 100, '台北市', array['美妝'], '[1]'::jsonb)$$,
  '22023', 'invalid collab_types', '報價項目必須是物件');
select throws_ok($$select public.create_creator_with_rates('甲', 'obtest_a', 'obtest_a', 100, '台北市', array['美妝'],
  '[{"collab_type":"Reels","price_twd":1},{"collab_type":"Reels","price_twd":2}]'::jsonb)$$,
  '22023', 'invalid collab_types', '合作形式不能重複');
select throws_ok($$select public.create_creator_with_rates('甲', 'obtest_a', 'obtest_a', 100, '台北市', array['美妝'],
  '[{"collab_type":"Reels","price_twd":-5}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格不能是負數');
select is((select count(*)::int from public.profiles where id = auth.uid()), 0, '報價有錯時帳號不會建立');

select matches(public.create_creator_with_rates('甲', 'obtest_a', 'obtest_a', 100, '台北市', array['美妝'],
  '[{"collab_type":"Reels","price_twd":4500},{"collab_type":"產品互惠","price_twd":0}]'::jsonb), '^.+$', '建立成功並回傳驗證碼');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'pending', '狀態是審核中');
select is((select collab_types from public.creator_profiles where user_id = auth.uid()), array['Reels', '產品互惠'], '報價的合作形式成為想接的合作');
select results_eq($$select collab_type, price_twd from public.creator_rates where creator_id = auth.uid() order by price_twd$$,
  $$values ('產品互惠', 0), ('Reels', 4500)$$, '報價已存');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000f4002","role":"authenticated"}', true);
select ok(not public.handle_available('obtest_a'), '已經有人用的網址不能用（審核中的也算）');
select throws_ok($$select public.create_creator_with_rates('乙', 'obtest_a', 'obtest_b', 100, '台北市', array['美妝'],
  '[{"collab_type":"Reels","price_twd":1}]'::jsonb)$$, '23505', 'handle taken', '網址被搶走時回 handle taken');

select * from finish();
rollback;
