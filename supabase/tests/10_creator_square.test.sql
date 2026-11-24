begin;
create extension if not exists pgtap with schema extensions;
select plan(96);

-- 本機資料庫可能已有測試快速登入或 E2E 留下的已審核創作者：先全部改成停權，只讓本檔的 fixture 是已審核
-- （整個檔案在 transaction 裡，結束時 rollback 還原）
update public.creator_profiles set status = 'suspended' where status = 'approved';

-- 501、502 品牌；511–517 已審核創作者；520 待審核；521 停權；540 還沒建立帳號
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000501', 'sq-b1@test.local'),
  ('00000000-0000-0000-0000-000000000502', 'sq-b2@test.local'),
  ('00000000-0000-0000-0000-000000000511', 'sq-c1@test.local'),
  ('00000000-0000-0000-0000-000000000512', 'sq-c2@test.local'),
  ('00000000-0000-0000-0000-000000000513', 'sq-c3@test.local'),
  ('00000000-0000-0000-0000-000000000514', 'sq-c4@test.local'),
  ('00000000-0000-0000-0000-000000000515', 'sq-c5@test.local'),
  ('00000000-0000-0000-0000-000000000516', 'sq-c6@test.local'),
  ('00000000-0000-0000-0000-000000000517', 'sq-c7@test.local'),
  ('00000000-0000-0000-0000-000000000520', 'sq-pending@test.local'),
  ('00000000-0000-0000-0000-000000000521', 'sq-suspended@test.local'),
  ('00000000-0000-0000-0000-000000000540', 'sq-none@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000501', 'brand', '品牌一'),
  ('00000000-0000-0000-0000-000000000502', 'brand', '品牌二'),
  ('00000000-0000-0000-0000-000000000511', 'creator', 'Amy 美妝'),
  ('00000000-0000-0000-0000-000000000512', 'creator', 'Ben 旅遊'),
  ('00000000-0000-0000-0000-000000000513', 'creator', 'Cat 100%'),
  ('00000000-0000-0000-0000-000000000514', 'creator', 'Dan_x'),
  ('00000000-0000-0000-0000-000000000515', 'creator', 'Eve'),
  ('00000000-0000-0000-0000-000000000516', 'creator', 'Fay'),
  ('00000000-0000-0000-0000-000000000517', 'creator', 'Gus'),
  ('00000000-0000-0000-0000-000000000520', 'creator', 'Amy pending'),
  ('00000000-0000-0000-0000-000000000521', 'creator', 'Amy suspended');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000501', '品牌一'),
  ('00000000-0000-0000-0000-000000000502', '品牌二');
insert into public.creator_profiles
  (user_id, handle, ig_username, follower_count, engagement_rate, region, categories, style_tags, collab_types, status, created_at)
values
  ('00000000-0000-0000-0000-000000000511', 'sq_amy', 'amy.ig', 500, 1.5, '台北市',
   array['美妝'], array['自然', '清新'], array['IG 貼文', 'Reels'], 'approved', '2026-01-01'),
  ('00000000-0000-0000-0000-000000000512', 'sq_ben', 'ben_travel', 5000, 3.2, '台中市',
   array['旅遊'], array['戶外'], array['Reels'], 'approved', '2026-01-02'),
  ('00000000-0000-0000-0000-000000000513', 'sq_cat', 'cat.ig', 50000, 5.5, '台北市',
   array['美食', '生活'], array['自然'], array['IG 貼文'], 'approved', '2026-01-03'),
  ('00000000-0000-0000-0000-000000000514', 'sq_dan', 'danx', 150000, null, '高雄市',
   array['3C'], '{}', array['限時動態'], 'approved', '2026-01-04'),
  ('00000000-0000-0000-0000-000000000515', 'sq_eve', 'eve.ig', 1000, 5.0, 'Narnia',
   array['穿搭', '怪類別'], array['清新'], array['產品互惠'], 'approved', '2026-01-05'),
  ('00000000-0000-0000-0000-000000000516', 'sq_fay', 'fay.ig', 10000, 1.0, '台北市',
   array['美妝'], '{}', array['IG 貼文'], 'approved', '2026-01-06'),
  ('00000000-0000-0000-0000-000000000517', 'sq_gus', 'gus.ig', 99999, 2.99, '新北市',
   array['美妝'], '{}', array['IG 貼文'], 'approved', '2026-01-06'),
  ('00000000-0000-0000-0000-000000000520', 'sq_pen', 'pen.ig', 800, 4.0, '台北市',
   array['美妝'], array['秘密'], array['IG 貼文'], 'pending', '2026-01-07'),
  ('00000000-0000-0000-0000-000000000521', 'sq_sus', 'sus.ig', 800, 4.0, '台北市',
   array['美妝'], array['秘密'], array['IG 貼文'], 'suspended', '2026-01-08');
insert into public.creator_rates (creator_id, collab_type, price_twd) values
  ('00000000-0000-0000-0000-000000000511', 'IG 貼文', 3000),
  ('00000000-0000-0000-0000-000000000511', 'Reels', 6000),
  ('00000000-0000-0000-0000-000000000512', 'Reels', 8000),
  ('00000000-0000-0000-0000-000000000513', 'IG 貼文', 25000),
  ('00000000-0000-0000-0000-000000000515', '產品互惠', 0),
  ('00000000-0000-0000-0000-000000000516', 'IG 貼文', 5000),
  ('00000000-0000-0000-0000-000000000517', 'IG 貼文', 20000),
  ('00000000-0000-0000-0000-000000000520', 'IG 貼文', 100);
-- 故意不照 position 順序新增，確認回傳依 position 排序且只取前三張
insert into public.creator_portfolio_items (creator_id, image_path, position) values
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p3.jpg', 3),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p1.jpg', 1),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p0.jpg', 0),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000511/portfolio-p2.jpg', 2);
insert into public.creator_favorites (brand_id, creator_id) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000512'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000516'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000520'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000511');

-- 結構與權限
select has_table('public', 'creator_favorites', '有 creator_favorites 資料表');
select col_is_pk('public', 'creator_favorites', array['brand_id', 'creator_id'], '主鍵是 (brand_id, creator_id)');
select ok(has_table_privilege('authenticated', 'public.creator_favorites', 'SELECT'), 'authenticated 可以讀收藏（受 RLS 限制）');
select ok(has_table_privilege('authenticated', 'public.creator_favorites', 'DELETE'), 'authenticated 可以刪收藏（受 RLS 限制）');
select ok(has_column_privilege('authenticated', 'public.creator_favorites', 'creator_id', 'INSERT'), 'authenticated 可以新增收藏');
select ok(not has_column_privilege('authenticated', 'public.creator_favorites', 'created_at', 'INSERT'), 'created_at 不接受寫入');
select ok(not has_table_privilege('authenticated', 'public.creator_favorites', 'UPDATE'), '收藏不開放 UPDATE');
select ok(not has_table_privilege('anon', 'public.creator_favorites', 'SELECT'), 'anon 讀不到收藏');
select ok(has_table_privilege('service_role', 'public.creator_favorites', 'SELECT'), 'service_role 可以讀收藏');
select ok(not has_table_privilege('service_role', 'public.creator_favorites', 'INSERT'), 'service_role 不能新增收藏');
select ok(not has_function_privilege('anon',
  'public.search_creators(text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer)',
  'EXECUTE'), 'anon 不能呼叫 search_creators');
select ok(has_function_privilege('authenticated',
  'public.search_creators(text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer)',
  'EXECUTE'), 'authenticated 可以呼叫 search_creators（函式內再檢查是不是品牌）');
select ok(not has_function_privilege('service_role',
  'public.search_creators(text, boolean, text[], text[], integer, integer, numeric, integer, integer, text[], text[], text, integer, integer)',
  'EXECUTE'), 'service_role 不能呼叫 search_creators');
select ok(not has_function_privilege('anon', 'public.popular_style_tags()', 'EXECUTE'), 'anon 不能呼叫 popular_style_tags');
select ok(has_function_privilege('authenticated', 'public.popular_style_tags()', 'EXECUTE'), 'authenticated 可以呼叫 popular_style_tags');
select has_index('public', 'creator_profiles', 'creator_profiles_status_created_idx', '索引 creator_profiles(status, created_at desc)');
select has_index('public', 'creator_profiles', 'creator_profiles_categories_gin', 'categories GIN 索引');
select has_index('public', 'creator_profiles', 'creator_profiles_style_tags_gin', 'style_tags GIN 索引');
select has_index('public', 'creator_profiles', 'creator_profiles_collab_types_gin', 'collab_types GIN 索引');
select has_index('public', 'creator_rates', 'creator_rates_creator_price_idx', '索引 creator_rates(creator_id, price_twd)');
select has_index('public', 'creator_favorites', 'creator_favorites_brand_created_idx', '索引 creator_favorites(brand_id, created_at desc)');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.search_creators()$$, '42501', null, '訪客不能搜尋');
select throws_ok($$select * from public.popular_style_tags()$$, '42501', null, '訪客不能讀熱門標籤');
select throws_ok($$select * from public.creator_favorites$$, '42501', null, '訪客讀不到收藏');

-- 創作者
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000511","role":"authenticated"}', true);
select throws_ok($$select * from public.search_creators()$$, '42501', 'not a brand', '創作者不能搜尋');
select throws_ok($$select * from public.popular_style_tags()$$, '42501', 'not a brand', '創作者不能讀熱門標籤');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000512')$$,
  '42501', null, '創作者不能收藏');
select is((select count(*)::int from public.creator_favorites), 0, '創作者讀不到任何收藏');

-- 還沒建立帳號的使用者
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000540","role":"authenticated"}', true);
select throws_ok($$select * from public.search_creators()$$, '42501', 'not a brand', '沒有 profile 的使用者不能搜尋');

-- 品牌一
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);

-- 只列已審核、總數
select is((select count(*)::int from public.search_creators()), 7, '只列出 7 位已審核的創作者');
select is((select count(*)::int from public.search_creators() where handle in ('sq_pen', 'sq_sus')), 0,
  '待審核與停權的不列出');
select is((select distinct total_count::int from public.search_creators(p_limit => 2)), 7,
  'total_count 是全部符合的數量，不受 p_limit 影響');

-- 四種排序（同一天加入的 fay、gus 以 user_id 決定先後）
select is(array(select t.handle from public.search_creators() with ordinality t order by t.ordinality),
  array['sq_fay', 'sq_gus', 'sq_eve', 'sq_dan', 'sq_cat', 'sq_ben', 'sq_amy'], '預設最新加入');
select is(array(select t.handle from public.search_creators(p_sort => 'followers') with ordinality t order by t.ordinality),
  array['sq_dan', 'sq_gus', 'sq_cat', 'sq_fay', 'sq_ben', 'sq_eve', 'sq_amy'], '粉絲數高到低');
select is(array(select t.handle from public.search_creators(p_sort => 'engagement') with ordinality t order by t.ordinality),
  array['sq_cat', 'sq_eve', 'sq_ben', 'sq_gus', 'sq_amy', 'sq_fay', 'sq_dan'], '互動率高到低，沒填的排最後');
select is(array(select t.handle from public.search_creators(p_sort => 'price') with ordinality t order by t.ordinality),
  array['sq_eve', 'sq_amy', 'sq_fay', 'sq_ben', 'sq_gus', 'sq_cat', 'sq_dan'], '起價低到高，沒有報價的排最後');
select is(array(select t.handle from public.search_creators(p_sort => 'drop table') with ordinality t order by t.ordinality),
  array['sq_fay', 'sq_gus', 'sq_eve', 'sq_dan', 'sq_cat', 'sq_ben', 'sq_amy'], '不認得的排序當成最新加入');

-- 分頁穩定：逐頁接起來等於一次取完，不重複也不漏
select is(
  array(select t.handle from public.search_creators(p_limit => 3, p_offset => 0) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_limit => 3, p_offset => 3) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_limit => 3, p_offset => 6) with ordinality t order by t.ordinality),
  array['sq_fay', 'sq_gus', 'sq_eve', 'sq_dan', 'sq_cat', 'sq_ben', 'sq_amy'], '最新加入分頁穩定');
select is(
  array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 0) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 2) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 4) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'price', p_limit => 2, p_offset => 6) with ordinality t order by t.ordinality),
  array['sq_eve', 'sq_amy', 'sq_fay', 'sq_ben', 'sq_gus', 'sq_cat', 'sq_dan'], '起價排序分頁穩定');
select is(
  array(select t.handle from public.search_creators(p_sort => 'engagement', p_limit => 4, p_offset => 0) with ordinality t order by t.ordinality)
  || array(select t.handle from public.search_creators(p_sort => 'engagement', p_limit => 4, p_offset => 4) with ordinality t order by t.ordinality),
  array['sq_cat', 'sq_eve', 'sq_ben', 'sq_gus', 'sq_amy', 'sq_fay', 'sq_dan'], '互動率排序分頁穩定');
select is((select count(*)::int from public.search_creators(p_limit => 0)), 1, 'p_limit 小於 1 時當成 1');
select is((select count(*)::int from public.search_creators(p_limit => 1000)), 7, 'p_limit 過大不報錯（上限 48）');
select is((select count(*)::int from public.search_creators(p_offset => 100)), 0, '超過最後一頁回傳空的');

-- 關鍵字
select is(array(select handle from public.search_creators(p_keyword => 'amy') order by handle),
  array['sq_amy'], '關鍵字比對名稱、handle，不分大小寫，未審核的不列出');
select is(array(select handle from public.search_creators(p_keyword => 'BEN_T') order by handle),
  array['sq_ben'], '關鍵字比對 IG 帳號');
select is(array(select handle from public.search_creators(p_keyword => '%') order by handle),
  array['sq_cat'], '% 照字面比對');
select is((select count(*)::int from public.search_creators(p_keyword => 'y_')), 0, '_ 照字面比對（不是萬用字元）');
select is((select count(*)::int from public.search_creators(p_keyword => 'sq_')), 7, '_ 照字面比對時仍比得到');
select is((select count(*)::int from public.search_creators(p_keyword => '\')), 0, '反斜線不報錯');
select is(array(select handle from public.search_creators(p_keyword => '  eve  ') order by handle),
  array['sq_eve'], '關鍵字前後空白會去掉');
select is((select count(*)::int from public.search_creators(p_keyword => '   ')), 7, '只有空白的關鍵字等於沒填');

-- 篩選：多選欄位內 OR、不同欄位 AND
select is(array(select handle from public.search_creators(p_categories => array['旅遊', '3C']) order by handle),
  array['sq_ben', 'sq_dan'], '內容領域多選是 OR');
select is(array(select handle from public.search_creators(p_categories => array['美妝'], p_regions => array['台北市']) order by handle),
  array['sq_amy', 'sq_fay'], '內容領域與地區是 AND');
select is(array(select handle from public.search_creators(p_style_tags => array['自然']) order by handle),
  array['sq_amy', 'sq_cat'], '風格標籤');
select is(array(select handle from public.search_creators(p_style_tags => array['自然', '清新'], p_regions => array['台北市']) order by handle),
  array['sq_amy', 'sq_cat'], '風格標籤 OR 加上地區 AND');
select is(array(select handle from public.search_creators(p_collab_types => array['Reels', '限時動態']) order by handle),
  array['sq_amy', 'sq_ben', 'sq_dan'], '合作類型多選是 OR');
select is(array(select handle from public.search_creators(p_regions => array['Narnia']) order by handle),
  array['sq_eve'], '清單以外的地區也能比對（容忍舊資料）');
select is(array(select handle from public.search_creators(p_categories => array['怪類別']) order by handle),
  array['sq_eve'], '清單以外的內容領域也能比對');
select is((select count(*)::int from public.search_creators(p_regions => array['不存在的地方'])), 0, '比對不到時回傳空的，不報錯');
select is((select count(*)::int from public.search_creators(p_categories => '{}')), 7, '空陣列代表不篩選');
select is(array(select handle from public.search_creators(p_follower_max => 1000) order by handle),
  array['sq_amy'], '粉絲 1 千以下（不含 1,000）');
select is(array(select handle from public.search_creators(p_follower_min => 1000, p_follower_max => 10000) order by handle),
  array['sq_ben', 'sq_eve'], '粉絲 1 千到 1 萬（含下限、不含上限）');
select is(array(select handle from public.search_creators(p_follower_min => 10000, p_follower_max => 100000) order by handle),
  array['sq_cat', 'sq_fay', 'sq_gus'], '粉絲 1 萬到 10 萬');
select is(array(select handle from public.search_creators(p_follower_min => 100000) order by handle),
  array['sq_dan'], '粉絲 10 萬以上');
select is(array(select handle from public.search_creators(p_engagement_min => 3) order by handle),
  array['sq_ben', 'sq_cat', 'sq_eve'], '互動率 ≥ 3%，沒填的不列出');
select is(array(select handle from public.search_creators(p_price_max => 5000) order by handle),
  array['sq_amy', 'sq_eve'], '起價 5 千以下（不含 5,000）');
select is(array(select handle from public.search_creators(p_price_min => 5000, p_price_max => 20000) order by handle),
  array['sq_ben', 'sq_fay'], '起價 5 千到 2 萬');
select is(array(select handle from public.search_creators(p_price_min => 20000) order by handle),
  array['sq_cat', 'sq_gus'], '起價 2 萬以上，沒有報價的不列出');
select is(array(select handle from public.search_creators(p_categories => array['美妝'], p_price_min => 5000) order by handle),
  array['sq_fay', 'sq_gus'], '內容領域與起價是 AND');

-- 收藏
select is(array(select handle from public.search_creators(p_favorites_only => true) order by handle),
  array['sq_ben', 'sq_fay'], '只看收藏（收藏的待審核創作者不列出）');
select is((select is_favorite from public.search_creators() where handle = 'sq_ben'), true, '自己收藏的 is_favorite 是 true');
select is((select is_favorite from public.search_creators() where handle = 'sq_amy'), false, '別的品牌收藏的不算');

-- 每列的欄位
select is((select min_price from public.search_creators() where handle = 'sq_amy'), 3000, '起價是最低報價');
select is((select post_price from public.search_creators() where handle = 'sq_amy'), 3000, 'IG 貼文報價');
select is((select min_price from public.search_creators() where handle = 'sq_ben'), 8000, '只有 Reels 時起價是 Reels 的價格');
select is((select post_price from public.search_creators() where handle = 'sq_ben'), null::integer, '沒有 IG 貼文報價時是 null');
select is((select min_price from public.search_creators() where handle = 'sq_dan'), null::integer, '沒有報價時起價是 null');
select is((select portfolio_paths from public.search_creators() where handle = 'sq_amy'),
  array['00000000-0000-0000-0000-000000000511/portfolio-p0.jpg',
        '00000000-0000-0000-0000-000000000511/portfolio-p1.jpg',
        '00000000-0000-0000-0000-000000000511/portfolio-p2.jpg'], '作品依 position 取前三張');
select is((select portfolio_paths from public.search_creators() where handle = 'sq_ben'), '{}'::text[], '沒有作品是空陣列');
select is((select display_name from public.search_creators() where handle = 'sq_cat'), 'Cat 100%', '回傳顯示名稱');
select is((select engagement_rate from public.search_creators() where handle = 'sq_gus'), 2.99::numeric, '回傳互動率');

-- 熱門風格標籤（只算已審核的）
select is(array(select tag from public.popular_style_tags() order by tag),
  array(select unnest(array['自然', '清新', '戶外']) order by 1), '熱門標籤只算已審核的創作者');
select is((select uses::int from public.popular_style_tags() where tag = '自然'), 2, '回傳使用次數');
select is((select tag from public.popular_style_tags() limit 1) in ('自然', '清新'), true, '次數多的排前面');

-- 收藏的 RLS
select is((select count(*)::int from public.creator_favorites), 3, '品牌只看得到自己的收藏');
select lives_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000511')$$,
  '品牌可以收藏');
select is((select is_favorite from public.search_creators() where handle = 'sq_amy'), true, '收藏後 is_favorite 是 true');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000516')$$,
  '23505', null, '重複收藏是 unique violation（app 視為成功）');
select throws_ok(
  $$insert into public.creator_favorites (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000513')$$,
  '42501', null, '不能幫別的品牌收藏');
select throws_ok(
  $$update public.creator_favorites set creator_id = '00000000-0000-0000-0000-000000000513'
    where creator_id = '00000000-0000-0000-0000-000000000512'$$,
  '42501', null, '收藏不能修改');
-- RLS 讓別的品牌的收藏「看不到」，所以刪除只會影響 0 列（reset role 後再確認品牌二的收藏還在）
delete from public.creator_favorites where brand_id = '00000000-0000-0000-0000-000000000502';
delete from public.creator_favorites where creator_id = '00000000-0000-0000-0000-000000000512';
select is((select count(*)::int from public.creator_favorites
           where creator_id = '00000000-0000-0000-0000-000000000512'), 0, '可以取消自己的收藏');
select is(array(select handle from public.search_creators(p_favorites_only => true) order by handle),
  array['sq_amy', 'sq_fay'], '新增與取消後，只看收藏的結果跟著變');

-- 品牌二
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000502","role":"authenticated"}', true);
select is(array(select handle from public.search_creators(p_favorites_only => true) order by handle),
  array['sq_amy'], '每個品牌只看到自己的收藏');

reset role;
select is((select count(*)::int from public.creator_favorites
           where brand_id = '00000000-0000-0000-0000-000000000502'), 1, '品牌一刪不到品牌二的收藏');
select is((select count(*)::int from public.creator_favorites
           where creator_id = '00000000-0000-0000-0000-000000000520'), 1, '資料庫允許收藏未審核的創作者');
select is((select count(*)::int from public.creator_favorites), 4, '收藏總數正確（原本 4 筆，新增 1、取消 1）');

select * from finish();
rollback;
