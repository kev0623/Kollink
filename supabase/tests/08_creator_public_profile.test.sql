begin;
create extension if not exists pgtap with schema extensions;
select plan(83);

-- f1 品牌、f2 已審核創作者（mei）、f3 待審核創作者（ming）、f4 另一位已審核創作者（hua）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test.local'),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@test.local'),
  ('00000000-0000-0000-0000-0000000000f4', 'f4@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000000f1', 'brand', '品牌F'),
  ('00000000-0000-0000-0000-0000000000f2', 'creator', '小美'),
  ('00000000-0000-0000-0000-0000000000f3', 'creator', '阿明'),
  ('00000000-0000-0000-0000-0000000000f4', 'creator', '小華');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000f1', '品牌F');
insert into public.creator_profiles (user_id, handle, ig_username, status, collab_types) values
  ('00000000-0000-0000-0000-0000000000f2', 'mei', 'mei.ig', 'approved', array['IG 貼文']),
  ('00000000-0000-0000-0000-0000000000f3', 'ming', 'ming.ig', 'pending', array['IG 貼文']),
  ('00000000-0000-0000-0000-0000000000f4', 'hua', 'hua.ig', 'approved', '{}');
insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-0000000000f2', 'IG 貼文', 4500),
  ('00000000-0000-0000-0000-0000000000f3', 'IG 貼文', 3000);
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2/portfolio-a.jpg', 0),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2/portfolio-b.jpg', 1),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f3/portfolio-a.jpg', 0);

-- 結構與權限
select has_column('public', 'creator_profiles', 'avatar_path', '有 avatar_path 欄位');
select has_column('public', 'creator_profiles', 'audience_age', '有 audience_age 欄位');
select ok(not has_table_privilege('authenticated', 'public.creator_rates', 'INSERT'), 'authenticated 沒有 creator_rates INSERT');
select ok(not has_table_privilege('authenticated', 'public.creator_rates', 'UPDATE'), 'authenticated 沒有 creator_rates UPDATE');
select ok(not has_table_privilege('authenticated', 'public.creator_rates', 'DELETE'), 'authenticated 沒有 creator_rates DELETE');
select ok(has_column_privilege('anon', 'public.creator_portfolio_items', 'image_path', 'SELECT'), 'anon 可以讀作品（受 RLS 限制）');
select ok(not has_table_privilege('authenticated', 'public.creator_portfolio_items', 'INSERT'), 'authenticated 沒有作品 INSERT');
select ok(not has_table_privilege('service_role', 'public.creator_portfolio_items', 'INSERT'), 'service_role 沒有作品 INSERT');
select ok(has_function_privilege('anon', 'public.get_public_creator(text)', 'EXECUTE'), 'anon 可以呼叫 get_public_creator');
select ok(not has_function_privilege('anon', 'public.set_creator_rates(jsonb)', 'EXECUTE'), 'anon 不能呼叫 set_creator_rates');
select ok(not has_function_privilege('authenticated', 'public.check_text_list(text[], text, integer, integer)', 'EXECUTE'),
  '內部檢查函式不開放');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select display_name from public.get_public_creator('mei')), '小美', '訪客讀得到已審核創作者的名稱');
select is((select is_self from public.get_public_creator('mei')), false, '訪客的 is_self 是 false');
select is((select count(*)::int from public.get_public_creator('ming')), 0, '訪客讀不到待審核的創作者');
select is((select count(*)::int from public.get_public_creator('nobody')), 0, '不存在的 handle 沒有資料');
select is((select count(*)::int from public.creator_portfolio_items), 2, '訪客只看得到已審核創作者的作品');
-- 20261129000100_security_hardening.sql：anon 不再有 creator_rates 的 select 權限（原本靠沒有 anon policy 回 0 筆）
select throws_ok($$select count(*) from public.creator_rates$$, '42501', null, '訪客看不到報價');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, null)$$,
  '42501', null, '訪客不能修改公開頁');
select throws_ok(
  $$insert into public.creator_portfolio_items (creator_id, image_path, position)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2/portfolio-x.jpg', 2)$$,
  '42501', null, '訪客不能直接新增作品');

-- 品牌
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_rates where creator_id = '00000000-0000-0000-0000-0000000000f2'), 1,
  '品牌看得到已審核創作者的報價');
select is((select count(*)::int from public.creator_rates where creator_id = '00000000-0000-0000-0000-0000000000f3'), 0,
  '品牌看不到待審核創作者的報價');
select is((select count(*)::int from public.get_public_creator('ming')), 0, '品牌讀不到待審核的創作者');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, null)$$,
  '42501', 'not a creator', '品牌不能修改創作者公開頁');
select throws_ok($$select public.set_creator_portfolio('[]'::jsonb)$$,
  '42501', 'not a creator', '品牌不能設定作品');
select throws_ok($$select public.set_creator_rates('[]'::jsonb)$$,
  '42501', 'not a creator', '品牌不能設定報價');

-- 待審核創作者 f3（本人）
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
select is((select is_self from public.get_public_creator('ming')), true, '本人讀得到自己待審核的資料');
select is((select status from public.get_public_creator('ming')), 'pending', '回傳審核狀態');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = auth.uid()), 1,
  '本人看得到自己待審核的作品');
select throws_ok(
  $$insert into public.creator_rates (creator_id, collab_type, price_twd) values (auth.uid(), 'Reels', 1)$$,
  '42501', null, '不能直接新增報價');
select throws_ok($$update public.creator_rates set price_twd = 1 where creator_id = auth.uid()$$,
  '42501', null, '不能直接修改報價');
select throws_ok($$delete from public.creator_rates where creator_id = auth.uid()$$,
  '42501', null, '不能直接刪除報價');
select throws_ok(
  $$insert into public.creator_portfolio_items (creator_id, image_path, position)
    values (auth.uid(), '00000000-0000-0000-0000-0000000000f3/portfolio-x.jpg', 3)$$,
  '42501', null, '不能直接新增作品');
select throws_ok($$update public.creator_portfolio_items set link_url = null where creator_id = auth.uid()$$,
  '42501', null, '不能直接修改作品');
select throws_ok($$delete from public.creator_portfolio_items where creator_id = auth.uid()$$,
  '42501', null, '不能直接刪除作品');

-- update_creator_public_profile 驗證
select lives_ok(
  $$select public.update_creator_public_profile(
      E'　日常穿搭分享 ', array[' 日系 ', '簡約'], array['IG 貼文', 'Reels'], 3.5, '18-24',
      '00000000-0000-0000-0000-0000000000f3/avatar-1.png')$$,
  '創作者可以修改公開頁資料');
select is((select bio from public.creator_profiles where user_id = auth.uid()), '日常穿搭分享', 'bio 去掉前後空白');
select is((select style_tags from public.creator_profiles where user_id = auth.uid()), array['日系', '簡約'],
  '風格標籤逐項清理');
select is((select collab_types from public.creator_profiles where user_id = auth.uid()), array['IG 貼文', 'Reels'],
  '想接的合作已存下');
select is((select engagement_rate from public.creator_profiles where user_id = auth.uid()), 3.50::numeric, '互動率已存下');
select is((select audience_age from public.creator_profiles where user_id = auth.uid()), '18-24', '受眾年齡已存下');
select is((select avatar_path from public.creator_profiles where user_id = auth.uid()),
  '00000000-0000-0000-0000-0000000000f3/avatar-1.png', '頭像路徑已存下');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'pending', '狀態沒有被改動');
select is((select handle from public.creator_profiles where user_id = auth.uid()), 'ming', 'handle 沒有被改動');
select throws_ok($$select public.update_creator_public_profile(repeat('長', 301), '{}', '{}', null, null, null)$$,
  '22023', 'invalid bio', 'bio 最多 300 字');
select throws_ok($$select public.update_creator_public_profile(E'小‮美', '{}', '{}', null, null, null)$$,
  '22023', 'invalid bio', 'bio 不可含雙向控制字元');
select throws_ok($$select public.update_creator_public_profile(null, array['a','b','c','d','e','f','g','h','i'], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '風格標籤最多 8 個');
select throws_ok($$select public.update_creator_public_profile(null, array[repeat('長', 13)], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '每個風格標籤最多 12 字');
select throws_ok($$select public.update_creator_public_profile(null, array['日系', ' 日系'], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '風格標籤不可重複');
select throws_ok($$select public.update_creator_public_profile(null, array[E'​'], '{}', null, null, null)$$,
  '22023', 'invalid style_tags', '只有零寬空白的標籤視為空白');
select throws_ok($$select public.update_creator_public_profile(null, '{}', array['a','b','c','d','e','f','g'], null, null, null)$$,
  '22023', 'invalid collab_types', '想接的合作最多 6 個');
select throws_ok($$select public.update_creator_public_profile(null, '{}', array[repeat('長', 21)], null, null, null)$$,
  '22023', 'invalid collab_types', '每個合作形式最多 20 字');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', 100.5, null, null)$$,
  '22023', 'invalid engagement_rate', '互動率不可超過 100');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', -1, null, null)$$,
  '22023', 'invalid engagement_rate', '互動率不可為負數');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, repeat('1', 11), null)$$,
  '22023', 'invalid audience_age', '受眾年齡最多 10 字');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, '00000000-0000-0000-0000-0000000000f2/avatar-1.png')$$,
  '22023', 'invalid avatar_path', '頭像不能指到別人的資料夾');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, '00000000-0000-0000-0000-0000000000f3/portfolio-1.png')$$,
  '22023', 'invalid avatar_path', '頭像檔名必須以 avatar- 開頭');
select throws_ok($$select public.update_creator_public_profile(null, '{}', '{}', null, null, '00000000-0000-0000-0000-0000000000f3/avatar-..png')$$,
  '22023', 'invalid avatar_path', '頭像路徑不可含 ..');

-- set_creator_portfolio
select lives_ok(
  $$select public.set_creator_portfolio('[
      {"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-2.jpg", "link_url": "https://www.instagram.com/p/ABC123/"},
      {"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": null}
    ]'::jsonb)$$,
  '創作者可以整批設定作品');
select is(
  (select array_agg(image_path order by position) from public.creator_portfolio_items where creator_id = auth.uid()),
  array['00000000-0000-0000-0000-0000000000f3/portfolio-2.jpg', '00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg'],
  '作品依陣列順序排列，舊的被取代');
select is((select link_url from public.creator_portfolio_items where creator_id = auth.uid() and position = 0),
  'https://www.instagram.com/p/ABC123/', 'IG 連結已存下');
select throws_ok(
  $$select public.set_creator_portfolio((select jsonb_agg(jsonb_build_object('image_path',
      '00000000-0000-0000-0000-0000000000f3/portfolio-' || i || '.jpg')) from generate_series(1, 7) as i))$$,
  '22023', 'invalid portfolio', '作品最多 6 張');
select throws_ok($$select public.set_creator_portfolio('{}'::jsonb)$$,
  '22023', 'invalid portfolio', '作品必須是陣列');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f2/portfolio-a.jpg"}]'::jsonb)$$,
  '22023', 'invalid image_path', '作品不能指到別人的資料夾');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/avatar-1.png"}]'::jsonb)$$,
  '22023', 'invalid image_path', '作品檔名必須以 portfolio- 開頭');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": "https://evil.com/p/1"}]'::jsonb)$$,
  '22023', 'invalid link_url', '連結必須是 instagram.com');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": "http://instagram.com/p/1"}]'::jsonb)$$,
  '22023', 'invalid link_url', '連結必須是 https');
select throws_ok($$select public.set_creator_portfolio('[{"image_path": "00000000-0000-0000-0000-0000000000f3/portfolio-1.jpg", "link_url": "https://instagram.com.evil.com/p/1"}]'::jsonb)$$,
  '22023', 'invalid link_url', '不接受假冒的 instagram 網域');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = auth.uid()), 2,
  '失敗的呼叫不會清掉原本的作品');

-- set_creator_rates（目前 collab_types = IG 貼文、Reels）
select lives_ok(
  $$select public.set_creator_rates('[{"collab_type": "IG 貼文", "price_twd": 4500}, {"collab_type": "Reels", "price_twd": 8000}]'::jsonb)$$,
  '創作者可以整批設定報價');
select is((select count(*)::int from public.creator_rates where creator_id = auth.uid()), 2, '報價已取代為 2 筆');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "限時動態", "price_twd": 1000}]'::jsonb)$$,
  '22023', 'invalid collab_type', '合作形式必須在自己的想接合作裡');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": 1}, {"collab_type": "Reels", "price_twd": 2}]'::jsonb)$$,
  '22023', 'invalid collab_type', '合作形式不可重複');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": -1}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格不可為負數');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": 10000001}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格上限 10,000,000');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": 1.5}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格必須是整數');
select throws_ok($$select public.set_creator_rates('[{"collab_type": "Reels", "price_twd": "100"}]'::jsonb)$$,
  '22023', 'invalid price_twd', '價格必須是數字');
select lives_ok($$select public.update_creator_public_profile(null, '{}', array['IG 貼文'], null, null, null)$$,
  '取消勾選 Reels');
select is((select array_agg(collab_type) from public.creator_rates where creator_id = auth.uid()), array['IG 貼文'],
  '取消勾選的合作形式，報價一併刪除');

-- 另一位已審核創作者 f4
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}', true);
select is((select count(*)::int from public.get_public_creator('ming')), 0, '其他創作者讀不到待審核的創作者');
select is((select count(*)::int from public.creator_portfolio_items where creator_id = '00000000-0000-0000-0000-0000000000f3'), 0,
  '其他創作者看不到待審核創作者的作品');
select lives_ok($$select public.set_creator_portfolio('[]'::jsonb)$$, '清空自己的作品');
select throws_ok($$delete from public.creator_rates where creator_id = '00000000-0000-0000-0000-0000000000f2'$$,
  '42501', null, '不能刪除別人的報價');

reset role;
select is((select count(*)::int from public.creator_portfolio_items where creator_id = '00000000-0000-0000-0000-0000000000f2'), 2,
  '別人的作品沒有被動到');

select * from finish();
rollback;
