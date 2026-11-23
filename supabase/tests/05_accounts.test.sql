begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test.local'),  -- 新品牌
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test.local'),  -- 新創作者
  ('00000000-0000-0000-0000-0000000000d3', 'd3@test.local');  -- 另一位新創作者

set local role authenticated;

-- 品牌 d1
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.profiles (id, role, display_name) values (auth.uid(), 'brand', 'x')$$,
  '42501', null, '不能直接新增 profiles');
select throws_ok($$select public.create_brand_account('   ', '美妝保養')$$,
  '22023', 'invalid brand_name', '品牌名稱不可為空白');
select throws_ok($$select public.create_brand_account('花粉', '美妝保養', 'https://evil.com/x.png')$$,
  '22023', 'invalid logo_url', 'Logo 必須在自己的資料夾');
select lives_ok($$select public.create_brand_account('　花粉選物 ', '美妝保養')$$,
  '品牌可以建立帳號');
select is((select role::text from public.profiles where id = auth.uid()), 'brand',
  '身分是品牌');
select is((select brand_name from public.brand_profiles where user_id = auth.uid()), '花粉選物',
  '品牌名稱去掉前後的全形與半形空白');
select throws_ok($$select public.create_brand_account('再一次', '食品飲料')$$,
  '23505', 'account already exists', '不能重複建立帳號');
select throws_ok(
  $$select public.create_creator_account('x', 'xhandle', 'xig', 1, '台北市', array['美妝'])$$,
  '23505', 'account already exists', '品牌不能再建立創作者資料');
select lives_ok(
  $$update public.brand_profiles
      set logo_url = 'http://127.0.0.1:54321/storage/v1/object/public/brand-logos/00000000-0000-0000-0000-0000000000d1/a.png'
    where user_id = auth.uid()$$,
  '品牌可以設定自己資料夾裡的 Logo');
select throws_ok(
  $$update public.brand_profiles
      set logo_url = 'http://127.0.0.1:54321/storage/v1/object/public/brand-logos/00000000-0000-0000-0000-0000000000d2/a.png'
    where user_id = auth.uid()$$,
  '22023', 'invalid logo_url', '不能用別人資料夾裡的 Logo');

-- 創作者 d2
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);

select throws_ok($$select public.create_creator_account('小美', 'Bad Handle', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid handle', 'handle 格式錯誤');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei ig', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid ig_username', 'IG 帳號格式錯誤');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', -1, '台北市', array['美妝'])$$,
  '22023', 'invalid follower_count', '粉絲數不可為負數');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', 100, '台北市', array[]::text[])$$,
  '22023', 'invalid categories', '至少要選 1 個內容領域');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', 100, '台北市', array['a','b','c','d','e','f'])$$,
  '22023', 'invalid categories', '最多 5 個內容領域');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', 100, '台北市', array['美妝','美妝'])$$,
  '22023', 'invalid categories', '內容領域不可重複');
select throws_ok($$select public.create_creator_account(repeat('長', 41), 'mei.daily', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid display_name', '顯示名稱最多 40 字');
select matches(
  public.create_creator_account('小美', 'mei.daily', 'mei.daily', 12000, '台北市', array['美妝', '穿搭']),
  '^[A-HJ-NP-Z2-9]{6}$', '建立創作者帳號並回傳 6 碼驗證碼');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'pending',
  '新創作者一律是待審核');
select is((select count(*)::int from public.creator_verifications), 1,
  '本人看得到自己的驗證碼');
select throws_ok($$update public.creator_verifications set code = 'AAAAAA'$$,
  '42501', null, '不能修改驗證碼');
select lives_ok($$update public.creator_profiles set handle = 'mei.new' where user_id = auth.uid()$$,
  '審核前可以修改 handle');
select is((select handle from public.creator_profiles where user_id = auth.uid()), 'mei.new',
  'handle 已更新');
select throws_ok($$update public.creator_profiles set status = 'approved' where user_id = auth.uid()$$,
  '42501', null, '不能自己改成已審核');
select throws_ok($$update public.creator_profiles set ig_username = 'x y' where user_id = auth.uid()$$,
  '23514', null, '更新時 IG 帳號格式也會被檢查');

-- 創作者 d3
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

select throws_ok($$select public.create_creator_account('阿明', 'mei.new', 'ming', 10, '台中市', array['美食'])$$,
  '23505', 'handle taken', 'handle 已被使用');
select is((select count(*)::int from public.profiles where id = auth.uid()), 0,
  'handle 重複時整筆不會建立');
select is((select count(*)::int from public.creator_verifications), 0,
  '看不到別人的驗證碼');
select lives_ok($$update public.creator_profiles set region = '高雄市' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '嘗試更新別人的創作者資料');
select lives_ok($$update public.brand_profiles set brand_name = '駭客' where user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  '嘗試更新別人的品牌資料');
select lives_ok($$update public.profiles set display_name = '駭客' where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '嘗試更新別人的名稱');

-- 以資料庫擁有者確認沒有被改到，並把 d2 審核通過
reset role;
select is((select region from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000000d2'), '台北市',
  '別人改不到創作者資料');
select is((select brand_name from public.brand_profiles where user_id = '00000000-0000-0000-0000-0000000000d1'), '花粉選物',
  '別人改不到品牌資料');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), '花粉選物',
  '別人改不到名稱');
update public.creator_profiles set status = 'approved' where user_id = '00000000-0000-0000-0000-0000000000d2';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select throws_ok($$update public.creator_profiles set handle = 'mei.again' where user_id = auth.uid()$$,
  '42501', 'handle locked after approval', '審核通過後不能修改 handle');
select lives_ok($$update public.creator_profiles set follower_count = 13000 where user_id = auth.uid()$$,
  '審核通過後仍可更新其他欄位');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.create_brand_account('x', 'y')$$,
  '42501', null, '訪客不能呼叫建立帳號函式');

select * from finish();
rollback;
