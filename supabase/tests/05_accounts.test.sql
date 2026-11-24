begin;
create extension if not exists pgtap with schema extensions;
select plan(122);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test.local'),  -- 新品牌
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test.local'),  -- 新創作者
  ('00000000-0000-0000-0000-0000000000d3', 'd3@test.local'),  -- 另一位新創作者
  ('00000000-0000-0000-0000-0000000000d4', 'd4@test.local'),  -- 管理員
  ('00000000-0000-0000-0000-0000000000d5', 'd5@test.local');  -- 新品牌（帶 Logo）
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d4');

set local role authenticated;

-- 品牌 d1
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.profiles (id, role, display_name) values (auth.uid(), 'brand', 'x')$$,
  '42501', null, '不能直接新增 profiles');
select throws_ok($$select public.create_brand_account('   ', '美妝保養')$$,
  '22023', 'invalid brand_name', '品牌名稱不可為空白');
select throws_ok($$select public.create_brand_account('花粉', '美妝保養', '00000000-0000-0000-0000-0000000000d2/a.png')$$,
  '22023', 'invalid logo_path', 'Logo 不能指到別人的資料夾');
select throws_ok($$select public.create_brand_account('花粉', '美妝保養', '00000000-0000-0000-0000-0000000000d1/..png')$$,
  '22023', 'invalid logo_path', 'Logo 檔名不能含 ..');
select throws_ok($$select public.create_brand_account('花粉', '美妝保養', '00000000-0000-0000-0000-0000000000d1/.hidden')$$,
  '22023', 'invalid logo_path', 'Logo 檔名不能以 . 開頭');
select throws_ok($$select public.create_brand_account('花粉', '美妝保養', 'https://evil.com/x.png')$$,
  '22023', 'invalid logo_path', 'Logo 不能是網址');
select throws_ok($$select public.create_brand_account('花粉', '   ')$$,
  '22023', 'invalid industry', '產業不可為空白');
select throws_ok($$select public.create_brand_account(E'\u200b\u200b', '美妝保養')$$,
  '22023', 'invalid brand_name', '品牌名稱只有零寬空白視為空白');
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
select is((select logo_path from public.brand_profiles where user_id = auth.uid()), null,
  '建立時沒帶 Logo 就是 null');
select throws_ok($$update public.brand_profiles set brand_name = 'x' where user_id = auth.uid()$$,
  '42501', null, '品牌不能直接修改 brand_profiles');
select throws_ok($$update public.profiles set display_name = 'x' where id = auth.uid()$$,
  '42501', null, '品牌不能直接修改 profiles');
select throws_ok($$delete from public.profiles where id = auth.uid()$$,
  '42501', null, '品牌不能直接刪除 profiles');
select throws_ok($$delete from public.brand_profiles where user_id = auth.uid()$$,
  '42501', null, '品牌不能直接刪除 brand_profiles');
select is((select count(*)::int from pg_constraint
            where conname = 'creator_profiles_handle_key'
              and conrelid = 'public.creator_profiles'::regclass), 1,
  'handle 唯一約束名稱是 creator_profiles_handle_key（錯誤對應依賴它）');
select lives_ok($$select public.update_brand_account(E'\u00a0花粉新名 ', '食品飲料', '00000000-0000-0000-0000-0000000000d1/a.png')$$,
  '品牌可以用函式修改並設定自己資料夾的 Logo');
select is((select logo_path from public.brand_profiles where user_id = auth.uid()), '00000000-0000-0000-0000-0000000000d1/a.png',
  'Logo 路徑已存下');
select is((select brand_name from public.brand_profiles where user_id = auth.uid()), '花粉新名',
  '前後的 NBSP 被去掉');
select is((select display_name from public.profiles where id = auth.uid()), '花粉新名',
  'display_name 與 brand_name 同步');
select throws_ok($$select public.update_brand_account('花粉', '美妝保養', '00000000-0000-0000-0000-0000000000d2/a.png')$$,
  '22023', 'invalid logo_path', '修改時也不能指到別人的資料夾');
select throws_ok($$select public.update_brand_account('花粉', '   ', null)$$,
  '22023', 'invalid industry', '修改時產業不可為空白');
select throws_ok($$select public.update_brand_account('', '美妝保養', null)$$,
  '22023', 'invalid brand_name', '修改時品牌名稱不可為空白');
select throws_ok($$select public.update_creator_account('x', 'xhandle', 'xig', 1, '台北市', array['美妝'])$$,
  '42501', 'not a creator', '品牌不能呼叫創作者修改函式');
select throws_ok($$insert into public.brand_profiles (user_id, brand_name, logo_path)
    values (auth.uid(), 'x', 'bad')$$,
  '42501', null, '不能直接新增 brand_profiles');

-- 創作者 d2
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);

select throws_ok($$select public.create_creator_account('小美', 'Bad Handle', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid handle', 'handle 格式錯誤');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei ig', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid ig_username', 'IG 帳號格式錯誤');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', -1, '台北市', array['美妝'])$$,
  '22023', 'invalid follower_count', '粉絲數不可為負數');
select throws_ok($$select public.create_creator_account(E'\u200b', 'mei.daily', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid display_name', '顯示名稱只有零寬空白視為空白');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', 100, '   ', array['美妝'])$$,
  '22023', 'invalid region', '地區不可為空白');
select throws_ok($$select public.create_creator_account('小美', 'mei.daily', 'mei', 100, repeat('長', 31), array['美妝'])$$,
  '22023', 'invalid region', '地區最多 30 字');
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
select throws_ok($$update public.creator_profiles set handle = 'mei.new' where user_id = auth.uid()$$,
  '42501', null, '創作者不能直接修改 creator_profiles');
select throws_ok($$update public.creator_profiles set status = 'approved' where user_id = auth.uid()$$,
  '42501', null, '不能自己改成已審核');
select throws_ok($$delete from public.creator_profiles where user_id = auth.uid()$$,
  '42501', null, '創作者不能直接刪除 creator_profiles');
select throws_ok($$select public.update_creator_account('', 'mei.new', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid display_name', '修改時顯示名稱不可為空白');
select throws_ok($$select public.update_creator_account('小美', 'Bad Handle', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid handle', '修改時 handle 格式錯誤');
select throws_ok($$select public.update_creator_account('小美', 'mei.new', 'mei', -1, '台北市', array['美妝'])$$,
  '22023', 'invalid follower_count', '修改時粉絲數不可為負數');
select throws_ok($$select public.update_creator_account(E'小\u202e美', 'mei.new', 'mei', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid display_name', '修改時顯示名稱有雙向控制字元視為無效');
select throws_ok($$select public.update_creator_account('小美', 'mei.new', 'mei', 100, '台北市', array['美妝', E'美\u202e妝'])$$,
  '22023', 'invalid categories', '修改時內容領域有雙向控制字元視為無效');
select throws_ok($$select public.update_creator_account('小美', 'mei.new', 'mei', 100, '台北市', array['美妝', E'美\u200b妝'])$$,
  '22023', 'invalid categories', '內部 U+200B 被移除後視為重複');
select throws_ok($$select public.update_brand_account('花粉', '美妝保養', null)$$,
  '42501', 'not a brand', '創作者不能呼叫品牌修改函式');
select throws_ok($$select public.update_creator_account('小美', 'mei.new', 'x y', 100, '台北市', array['美妝'])$$,
  '22023', 'invalid ig_username', '修改時 IG 帳號格式也會被檢查');
select throws_ok($$select public.update_creator_account('小美', 'mei.new', 'mei', 100, '', array['美妝'])$$,
  '22023', 'invalid region', '修改時地區不可為空白');
select throws_ok($$select public.update_creator_account('小美', 'mei.new', 'mei', 100, '台北市', array['美妝','美妝'])$$,
  '22023', 'invalid categories', '修改時內容領域不可重複');
select lives_ok($$select public.update_creator_account(E'\u3000小美美 ', 'mei.new', 'mei.daily', 15000, '新北市', array['美妝'])$$,
  '審核前可以用函式修改資料與 handle');
select is((select handle from public.creator_profiles where user_id = auth.uid()), 'mei.new',
  'handle 已更新');
select is((select region from public.creator_profiles where user_id = auth.uid()), '新北市',
  '地區已更新');
select is((select display_name from public.profiles where id = auth.uid()), '小美美',
  'display_name 同步且去掉全形空白');

-- 創作者 d3
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);

select throws_ok($$select public.create_creator_account('阿明', 'mei.new', 'ming', 10, '台中市', array['美食'])$$,
  '23505', 'handle taken', 'handle 已被使用');
select is((select count(*)::int from public.profiles where id = auth.uid()), 0,
  'handle 重複時整筆不會建立');
select is((select count(*)::int from public.creator_verifications), 0,
  '看不到別人的驗證碼');
select throws_ok($$update public.creator_profiles set region = '高雄市' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, '不能更新別人的創作者資料');
select throws_ok($$update public.brand_profiles set brand_name = '駭客' where user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, '不能更新別人的品牌資料');
select throws_ok($$update public.profiles set display_name = '駭客' where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, '不能更新別人的名稱');
select throws_ok($$select public.update_creator_account('阿明', 'mei.new', 'ming', 10, '台中市', array['美食'])$$,
  '42501', 'not a creator', '尚未建立帳號的人不能呼叫修改函式');

select lives_ok($$select public.create_creator_account('阿明', 'ming.d3', 'ming', 10, '台中市', array['美食'])$$,
  'handle 換一個就能建立');
select throws_ok($$select public.update_creator_account('阿明', 'mei.new', 'ming', 10, '台中市', array['美食'])$$,
  '23505', 'handle taken', '修改成已被使用的 handle 會被拒');

-- 品牌 d5：合法 Logo、零寬字元與 not authenticated
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.create_brand_account('x', 'y')$$,
  '42501', 'not authenticated', '沒有 sub 不能建立品牌');
select throws_ok($$select public.create_creator_account('x', 'xhandle', 'xig', 1, '台北市', array['美妝'])$$,
  '42501', 'not authenticated', '沒有 sub 不能建立創作者');
select throws_ok($$select public.update_brand_account('x', 'y', null)$$,
  '42501', 'not authenticated', '沒有 sub 不能修改品牌');
select throws_ok($$select public.update_creator_account('x', 'xhandle', 'xig', 1, '台北市', array['美妝'])$$,
  '42501', 'not authenticated', '沒有 sub 不能修改創作者');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}', true);
select throws_ok($$select public.create_brand_account(E'花\u202e粉', '美妝保養')$$,
  '22023', 'invalid brand_name', '品牌名稱中間有雙向控制字元視為無效');
select throws_ok($$select public.create_brand_account(E'\u3164', '美妝保養')$$,
  '22023', 'invalid brand_name', '品牌名稱只有 U+3164 視為空白');
select lives_ok($$select public.create_brand_account(E'\u3164花\u200b粉\ufe0f', '美妝保養', '00000000-0000-0000-0000-0000000000d5/logo-1.png')$$,
  '建立品牌時帶合法 Logo 路徑');
select is((select logo_path from public.brand_profiles where user_id = auth.uid()), '00000000-0000-0000-0000-0000000000d5/logo-1.png',
  'Logo 路徑已存下');
select is((select brand_name from public.brand_profiles where user_id = auth.uid()), '花粉',
  '前後的 U+3164 與 U+FE0F 被去掉、中間的零寬字元被移除');
select lives_ok($$select public.update_brand_account(E'花粉\u200c👩\u200d💻', '美妝保養', null)$$,
  '名稱含 emoji ZWJ 序列與 ZWNJ');
select is((select brand_name from public.brand_profiles where user_id = auth.uid()), E'花粉\u200c👩\u200d💻',
  '內部的 U+200C、U+200D 原樣保留');
select lives_ok($$select public.update_brand_account('花粉', '美妝保養', null)$$,
  '修改時 Logo 傳 null 代表移除');
select is((select logo_path from public.brand_profiles where user_id = auth.uid()), null,
  'Logo 已移除');

-- 以資料庫擁有者確認沒有被改到，並把 d2 審核通過
reset role;
select is((select region from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000000d2'), '新北市',
  '別人改不到創作者資料');
select is((select brand_name from public.brand_profiles where user_id = '00000000-0000-0000-0000-0000000000d1'), '花粉新名',
  '別人改不到品牌資料');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), '花粉新名',
  '別人改不到名稱');
select throws_ok(
  $$update public.brand_profiles set logo_path = 'bad' where user_id = '00000000-0000-0000-0000-0000000000d1'$$,
  '23514', null, '資料庫擁有者直接寫入不合法的 logo_path 也被 CHECK 擋下');
select is((select handle_locked_at from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000000d2'), null,
  '審核前 handle_locked_at 是 null');
update public.creator_profiles set status = 'approved' where user_id = '00000000-0000-0000-0000-0000000000d2';
select isnt((select handle_locked_at from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000000d2'), null,
  '審核通過時自動設定 handle_locked_at');

-- handle 鎖定：postgres 沒設 GUC 也被拒
select throws_ok(
  $$update public.creator_profiles set handle = 'mei.pg' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', 'handle locked after approval', 'postgres 沒設 GUC 不能改已審核的 handle');
select throws_ok(
  $$update public.creator_profiles set user_id = '00000000-0000-0000-0000-0000000000d4' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', 'handle locked after approval', 'postgres 沒設 GUC 不能改 user_id');
select throws_ok(
  $$update public.creator_profiles set handle_locked_at = now() where user_id = '00000000-0000-0000-0000-0000000000d3'$$,
  '42501', 'handle locked after approval', 'postgres 沒設 GUC 不能在 pending 的列設定 handle_locked_at');
select is((select handle_locked_at from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000000d3'), null,
  'pending 的列 handle_locked_at 仍是 null');
-- service_role 被拒
set local role service_role;
select throws_ok(
  $$update public.creator_profiles set handle = 'mei.svc' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, 'service_role 不能改已審核的 handle（service_role 沒有 handle 的 UPDATE 權限）');
-- 先改回 pending 再改 handle 也不行
select lives_ok(
  $$update public.creator_profiles set status = 'pending' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  'service_role 可以把狀態改回 pending');
select throws_ok(
  $$update public.creator_profiles set handle = 'mei.svc3' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, '退回 pending 後 handle 仍然鎖定（service_role 沒有 handle 的 UPDATE 權限）');
select throws_ok(
  $$update public.creator_profiles set handle_locked_at = null where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, 'service_role 不能改 handle_locked_at');
select throws_ok(
  $$update public.creator_profiles set user_id = '00000000-0000-0000-0000-0000000000d4' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, 'service_role 不能改 user_id');
select throws_ok(
  $$update public.creator_profiles set handle_locked_at = now() where user_id = '00000000-0000-0000-0000-0000000000d3'$$,
  '42501', null, 'service_role 不能在 pending 的列設定 handle_locked_at');
select throws_ok(
  $$insert into public.creator_profiles (user_id, handle, ig_username) values ('00000000-0000-0000-0000-0000000000d4', 'admin.x', 'x')$$,
  '42501', null, 'service_role 不能直接新增 creator_profiles');
select throws_ok(
  $$delete from public.creator_profiles where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, 'service_role 不能直接刪除 creator_profiles');
reset role;
update public.creator_profiles set status = 'approved' where user_id = '00000000-0000-0000-0000-0000000000d2';
-- 管理員 GUC 例外
select set_config('kollink.allow_handle_change', 'on', true);
select lives_ok(
  $$update public.creator_profiles set handle = 'mei.admin' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  'postgres 設了 GUC 可以改 handle');
select set_config('kollink.allow_handle_change', 'off', true);
-- GUC 但不是 postgres（service_role）仍被拒
set local role service_role;
select set_config('kollink.allow_handle_change', 'on', true);
select throws_ok(
  $$update public.creator_profiles set handle = 'mei.svc2' where user_id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, 'service_role 即使設了 GUC 也被拒（service_role 沒有 handle 的 UPDATE 權限）');
reset role;
select set_config('kollink.allow_handle_change', 'off', true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select throws_ok(
  $$select public.update_creator_account('小美美', 'mei.again', 'mei.daily', 15000, '新北市', array['美妝'])$$,
  '42501', 'handle locked after approval', '審核通過後用函式也不能改 handle');
select is(
  public.update_creator_account('小美美', 'mei.admin', 'mei.daily', 13000, '新北市', array['美妝']), null,
  '審核通過後 handle 與 IG 不變時仍可更新其他欄位，不回傳驗證碼');
select is((select follower_count from public.creator_profiles where user_id = auth.uid()), 13000,
  '粉絲數已更新');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'approved',
  '只改粉絲數仍是已審核');
select throws_ok($$select public.update_creator_account('小美美', 'mei.admin', 'mei.daily', 13000, '新北市', array[]::text[])$$,
  '22023', 'invalid categories', '審核通過後修改仍檢查內容領域');
select is(
  public.update_creator_account('小美美', 'mei.admin', 'MEI.DAILY', 13000, '新北市', array['美妝']), null,
  'IG 只差大小寫不算更換');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'approved',
  'IG 只差大小寫仍是已審核');
select throws_ok($$select public.update_creator_account('小美美', 'mei.admin', '@mei.daily', 13000, '新北市', array['美妝'])$$,
  '22023', 'invalid ig_username', 'IG 帶 @ 在資料庫端視為格式錯誤（前端先去掉）');
select set_config('t.old_code', (select code from public.creator_verifications), true);
select matches(
  public.update_creator_account('小美美', 'mei.admin', 'mei.other', 13000, '新北市', array['美妝']),
  '^[A-HJ-NP-Z2-9]{6}$', '審核通過後更換 IG 會回傳新驗證碼');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'pending',
  '更換 IG 後退回審核中');
select isnt((select code from public.creator_verifications), current_setting('t.old_code'),
  '新驗證碼與舊的不同');
select throws_ok(
  $$select public.update_creator_account('小美美', 'mei.again2', 'mei.other', 13000, '新北市', array['美妝'])$$,
  '42501', 'handle locked after approval', '退回審核中後 handle 仍然鎖定');

-- 停權的創作者換 IG：維持停權、換新驗證碼
reset role;
update public.creator_profiles set status = 'suspended' where user_id = '00000000-0000-0000-0000-0000000000d2';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
select set_config('t.old_code', (select code from public.creator_verifications), true);
select matches(
  public.update_creator_account('小美美', 'mei.admin', 'mei.third', 13000, '新北市', array['美妝']),
  '^[A-HJ-NP-Z2-9]{6}$', '停權中更換 IG 也會換新驗證碼');
select is((select status from public.creator_profiles where user_id = auth.uid()), 'suspended',
  '停權中更換 IG 仍是停權');
select isnt((select code from public.creator_verifications), current_setting('t.old_code'),
  '停權者的新驗證碼與舊的不同');

-- 管理員
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_verifications), 2,
  '管理員看得到所有人的驗證碼');

-- 訪客
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.create_brand_account('x', 'y')$$,
  '42501', null, '訪客不能呼叫建立品牌函式');
select throws_ok($$select public.create_creator_account('x', 'xhandle', 'xig', 1, '台北市', array['美妝'])$$,
  '42501', null, '訪客不能呼叫建立創作者函式');
select throws_ok($$select public.update_brand_account('x', 'y', null)$$,
  '42501', null, '訪客不能呼叫修改品牌函式');
select throws_ok($$select public.update_creator_account('x', 'xhandle', 'xig', 1, '台北市', array['美妝'])$$,
  '42501', null, '訪客不能呼叫修改創作者函式');
select throws_ok($$select * from public.creator_verifications$$,
  '42501', null, '訪客讀不到驗證碼');

select * from finish();
rollback;
