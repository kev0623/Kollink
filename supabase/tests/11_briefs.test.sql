begin;
create extension if not exists pgtap with schema extensions;
select plan(138);

-- 本機資料庫可能有 E2E 留下的招募：在這個 transaction 裡先刪掉（結束時 rollback 還原），
-- 讓計數只看本檔的 fixture。被合作案引用的招募刪不掉，改成草稿（創作者看不到）。
update public.briefs b set status = 'draft', published_at = null
 where exists (select 1 from public.collaborations c where c.brief_id = b.id);
delete from public.briefs b where not exists (select 1 from public.collaborations c where c.brief_id = b.id);

-- 601、602 品牌；611、612 已審核創作者；613 待審核創作者；619 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000601', 'bf-b1@test.local'),
  ('00000000-0000-0000-0000-000000000602', 'bf-b2@test.local'),
  ('00000000-0000-0000-0000-000000000611', 'bf-c1@test.local'),
  ('00000000-0000-0000-0000-000000000612', 'bf-c2@test.local'),
  ('00000000-0000-0000-0000-000000000613', 'bf-c3@test.local'),
  ('00000000-0000-0000-0000-000000000619', 'bf-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000601', 'brand', '品牌甲'),
  ('00000000-0000-0000-0000-000000000602', 'brand', '品牌乙'),
  ('00000000-0000-0000-0000-000000000611', 'creator', '小美'),
  ('00000000-0000-0000-0000-000000000612', 'creator', '阿明'),
  ('00000000-0000-0000-0000-000000000613', 'creator', '新人');
insert into public.brand_profiles (user_id, brand_name, logo_path) values
  ('00000000-0000-0000-0000-000000000601', '品牌甲', '00000000-0000-0000-0000-000000000601/logo.png'),
  ('00000000-0000-0000-0000-000000000602', '品牌乙', null);
insert into public.creator_profiles
  (user_id, handle, ig_username, follower_count, engagement_rate, region, categories, collab_types, status)
values
  ('00000000-0000-0000-0000-000000000611', 'bf_mei', 'bf_mei', 5000, 3.5, '台北市',
   array['美妝', '保養'], array['IG 貼文', 'Reels'], 'approved'),
  ('00000000-0000-0000-0000-000000000612', 'bf_ming', 'bf_ming', 100, null, '台中市',
   array['美食'], '{}', 'approved'),
  ('00000000-0000-0000-0000-000000000613', 'bf_new', 'bf_new', 50000, null, null,
   array['美妝'], array['IG 貼文'], 'pending');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000619');

-- 招募（以 superuser 直接建立各種狀態）
-- f01 甲 開放：門檻 1000、台北市、美妝、IG 貼文、預算 5000–20000 → 小美全部符合
-- f02 甲 開放：今天截止、不限條件、Reels、只有產品
-- f03 甲 開放但昨天截止
-- f04 甲 草稿
-- f05 甲 已關閉
-- f06 乙 開放：美食、限時動態、最高 3000
-- f09–f12 乙 開放、只有產品：對小美各只有一項不符合（粉絲／地區／內容領域／合作形式）
insert into public.briefs
  (id, brand_id, title, description, collab_types, categories, min_followers, region,
   budget_min_twd, budget_max_twd, includes_product, deadline, status, published_at, created_at)
values
  ('00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-000000000601', '春季保養開箱', '說明',
   array['IG 貼文'], array['美妝'], 1000, '台北市', 5000, 20000, false, public.today_tw() + 10, 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-000000000601', '今天截止的招募', '說明',
   array['Reels'], '{}', 0, null, null, null, true, public.today_tw(), 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f003', '00000000-0000-0000-0000-000000000601', '昨天截止的招募', '說明',
   array['IG 貼文'], '{}', 0, null, null, null, true, public.today_tw() - 1, 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f004', '00000000-0000-0000-0000-000000000601', '草稿', null,
   '{}', '{}', 0, null, null, null, false, null, 'draft', null, now()),
  ('00000000-0000-0000-0000-00000006f005', '00000000-0000-0000-0000-000000000601', '已關閉的招募', '說明',
   array['IG 貼文'], '{}', 0, null, null, null, true, public.today_tw() + 3, 'closed', now(), now()),
  ('00000000-0000-0000-0000-00000006f006', '00000000-0000-0000-0000-000000000602', '美食探店', '說明',
   array['限時動態'], array['美食'], 0, null, null, 3000, false, public.today_tw() + 5, 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f009', '00000000-0000-0000-0000-000000000602', '粉絲不夠', '說明',
   array['IG 貼文'], '{}', 5001, null, null, null, true, public.today_tw() + 20, 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f010', '00000000-0000-0000-0000-000000000602', '地區不同', '說明',
   array['IG 貼文'], '{}', 5000, '高雄市', null, null, true, public.today_tw() + 21, 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f011', '00000000-0000-0000-0000-000000000602', '領域不同', '說明',
   array['IG 貼文'], array['旅遊'], 0, null, null, null, true, public.today_tw() + 22, 'open', now(), now()),
  ('00000000-0000-0000-0000-00000006f012', '00000000-0000-0000-0000-000000000602', '形式不同', '說明',
   array['產品互惠'], '{}', 0, null, null, null, true, public.today_tw() + 23, 'open', now(), now());

-- 報名（superuser）：阿明報名了已截止的 f03；小美在已關閉的 f05 已錄取；
-- f06：阿明待處理、新人已撤回、小美未錄取（人數只算 applied 與 accepted → 1）
insert into public.brief_applications (id, brief_id, creator_id, status) values
  ('00000000-0000-0000-0000-00000006a003', '00000000-0000-0000-0000-00000006f003', '00000000-0000-0000-0000-000000000612', 'applied'),
  ('00000000-0000-0000-0000-00000006a005', '00000000-0000-0000-0000-00000006f005', '00000000-0000-0000-0000-000000000611', 'accepted'),
  ('00000000-0000-0000-0000-00000006a061', '00000000-0000-0000-0000-00000006f006', '00000000-0000-0000-0000-000000000612', 'applied'),
  ('00000000-0000-0000-0000-00000006a062', '00000000-0000-0000-0000-00000006f006', '00000000-0000-0000-0000-000000000613', 'withdrawn'),
  ('00000000-0000-0000-0000-00000006a063', '00000000-0000-0000-0000-00000006f006', '00000000-0000-0000-0000-000000000611', 'rejected');

-- ── A. 結構、台灣日期、CHECK ──
select has_column('public', 'briefs', 'cover_path', 'briefs 有 cover_path');
select hasnt_column('public', 'briefs', 'cover_url', 'cover_url 已改名');
select has_column('public', 'briefs', 'published_at', 'briefs 有 published_at');
select is(public.today_tw('2026-11-24 15:59:59+00'), '2026-11-24'::date, '台灣時間 23:59:59 還是同一天');
select is(public.today_tw('2026-11-24 16:00:00+00'), '2026-11-25'::date, '台灣時間 00:00 已是隔天');
select is(public.today_tw(), (now() at time zone 'Asia/Taipei')::date, '不帶參數時用現在時間');
select throws_ok(
  $$insert into public.briefs (brand_id, title, description, deadline, includes_product, status, published_at)
    values ('00000000-0000-0000-0000-000000000601', 'x', 'y', current_date, true, 'open', now())$$,
  '23514', null, '發佈的招募至少要有一種合作形式');
select throws_ok(
  $$insert into public.briefs (brand_id, title, description, deadline, collab_types, status, published_at)
    values ('00000000-0000-0000-0000-000000000601', 'x', 'y', current_date, array['IG 貼文'], 'open', now())$$,
  '23514', null, '發佈的招募要有預算或產品');
select lives_ok(
  $$insert into public.briefs (brand_id) values ('00000000-0000-0000-0000-000000000601')$$,
  '草稿可以沒有案名、說明、截止日（預設狀態是草稿）');
select throws_ok(
  $$insert into public.briefs (brand_id, cover_path)
    values ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000602/cover-a.jpg')$$,
  '23514', null, '封面路徑必須在自己的資料夾');
select throws_ok(
  $$insert into public.briefs (brand_id, title) values ('00000000-0000-0000-0000-000000000601', repeat('字', 61))$$,
  '23514', null, '案名最多 60 字');
select throws_ok(
  $$insert into public.briefs (brand_id, budget_max_twd) values ('00000000-0000-0000-0000-000000000601', 10000001)$$,
  '23514', null, '預算最多 10,000,000');
select throws_ok(
  $$insert into public.briefs (brand_id, title, description, deadline, collab_types, includes_product, status)
    values ('00000000-0000-0000-0000-000000000601', 'x', 'y', current_date, array['IG 貼文'], true, 'open')$$,
  '23514', null, '發佈的招募一定有 published_at');
select throws_ok(
  $$insert into public.briefs (brand_id, categories)
    values ('00000000-0000-0000-0000-000000000601', array['a', 'b', 'c', 'd', 'e', 'f'])$$,
  '23514', null, '內容領域最多 5 個');
select throws_ok(
  $$insert into public.brief_applications (brief_id, creator_id, message)
    values ('00000000-0000-0000-0000-00000006f001', '00000000-0000-0000-0000-000000000612', repeat('字', 501))$$,
  '23514', null, '報名留言最多 500 字');
-- 剛才 lives_ok 建立的草稿不影響後面的計數：刪掉
delete from public.briefs where brand_id = '00000000-0000-0000-0000-000000000601' and title is null;

-- ── B. 權限：直接寫入一律被拒絕；anon 沒有任何權限 ──
select is(has_table_privilege('anon', 'public.briefs', 'select,insert,update,delete'), false, 'anon 對 briefs 沒有任何權限');
select is(has_table_privilege('anon', 'public.brief_applications', 'select,insert,update,delete'), false, 'anon 對 brief_applications 沒有任何權限');
select is(has_function_privilege('anon', 'public.save_brief(uuid, text, text, text[], text[], integer, text, integer, integer, boolean, date, text, boolean)', 'execute'),
  false, 'anon 不能呼叫 save_brief');
select is(has_function_privilege('anon', 'public.list_opportunities(text, text, integer, integer)', 'execute'),
  false, 'anon 不能呼叫 list_opportunities');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.briefs (brand_id, title) values ('00000000-0000-0000-0000-000000000601', '直接新增')$$,
  '42501', null, '品牌不能直接新增招募');
select throws_ok(
  $$update public.briefs set title = '直接修改' where id = '00000000-0000-0000-0000-00000006f001'$$,
  '42501', null, '品牌不能直接修改招募');
select throws_ok(
  $$delete from public.briefs where id = '00000000-0000-0000-0000-00000006f004'$$,
  '42501', null, '品牌不能直接刪除招募');
select throws_ok(
  $$update public.brief_applications set status = 'accepted' where id = '00000000-0000-0000-0000-00000006a003'$$,
  '42501', null, '品牌不能直接改報名狀態');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.brief_applications (brief_id, creator_id) values ('00000000-0000-0000-0000-00000006f001', auth.uid())$$,
  '42501', null, '創作者不能直接新增報名');

-- ── C. 可見性 ──
-- 小美：開放未截止的 7 則（f01 f02 f06 f09–f12）＋ 自己報名過的已關閉 f05
select is((select count(*)::int from public.briefs), 8, '已審核創作者看得到開放中未截止的招募與自己報名過的');
select is((select count(*)::int from public.briefs where id = '00000000-0000-0000-0000-00000006f004'), 0, '創作者看不到草稿');
select is((select count(*)::int from public.briefs where id = '00000000-0000-0000-0000-00000006f003'), 0, '創作者看不到已截止的招募（沒報名過）');
select is((select count(*)::int from public.brief_applications), 2, '創作者只看得到自己的報名');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000612","role":"authenticated"}', true);
select is((select count(*)::int from public.briefs where id = '00000000-0000-0000-0000-00000006f003'), 1, '報名過的人看得到已截止的招募');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000613","role":"authenticated"}', true);
select is((select count(*)::int from public.briefs), 7, '未審核創作者也看得到開放中未截止的招募');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select is((select count(*)::int from public.briefs), 5, '品牌只看得到自己的招募');
select is((select count(*)::int from public.brief_applications), 3, '品牌只看得到自己招募的報名');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select is((select count(*)::int from public.briefs), 5, '品牌看得到自己的全部招募（含草稿、已截止、已關閉）');
select is((select count(*)::int from public.brief_applications), 2, '品牌甲看得到自己招募的 2 筆報名');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000619","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.briefs), 10, '管理員看得到全部招募');

-- ── D. 報名 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select isnt(
  public.apply_to_brief('00000000-0000-0000-0000-00000006f001', E'  想合作​  ', 8000), null,
  '已審核創作者可以報名，回傳報名 id');
select is(
  (select message || ':' || proposed_price_twd || ':' || status from public.brief_applications
    where brief_id = '00000000-0000-0000-0000-00000006f001' and creator_id = auth.uid()),
  '想合作:8000:applied', '留言經過 clean_text，狀態是待回覆');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f001')$$,
  '23505', 'already applied', '不能重複報名');
select lives_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f002')$$,
  '截止日當天（台灣時間）可以報名');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f003')$$,
  '55000', 'brief closed', '截止日隔天不能報名');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f005')$$,
  '55000', 'brief closed', '已關閉的招募不能報名');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f004')$$,
  'P0002', 'brief not found', '草稿當作不存在');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f009', repeat('字', 501))$$,
  '22023', 'invalid message', '留言最多 500 字');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f009', E'a‮b')$$,
  '22023', 'invalid message', '留言不能有雙向控制字元');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f009', null, 10000001)$$,
  '22023', 'invalid proposed_price_twd', '報價最多 10,000,000');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f009', null, -1)$$,
  '22023', 'invalid proposed_price_twd', '報價不能是負數');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000613","role":"authenticated"}', true);
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f001')$$,
  '42501', 'creator not approved', '未審核創作者不能報名');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f006')$$,
  '42501', 'not a creator', '品牌不能報名');

-- ── E. 撤回 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000612","role":"authenticated"}', true);
select throws_ok(
  $$select public.withdraw_application('00000000-0000-0000-0000-00000006a005')$$,
  'P0002', 'application not found', '不能撤回別人的報名');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select lives_ok(
  format('select public.withdraw_application(%L)',
    (select id from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f002' and creator_id = auth.uid())),
  '創作者可以撤回自己待回覆的報名');
select is(
  (select status from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f002' and creator_id = auth.uid()),
  'withdrawn', '撤回後狀態是 withdrawn');
select throws_ok(
  format('select public.withdraw_application(%L)',
    (select id from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f002' and creator_id = auth.uid())),
  '55000', 'application not pending', '已撤回的不能再撤回');
select throws_ok(
  $$select public.withdraw_application('00000000-0000-0000-0000-00000006a005')$$,
  '55000', 'application not pending', '已錄取的不能撤回');
select throws_ok(
  $$select public.apply_to_brief('00000000-0000-0000-0000-00000006f002')$$,
  '23505', 'already applied', '撤回後不能再報名同一則');

-- ── F. 錄取與婉拒 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000006a003', 5000, 'IG 貼文 1 篇')$$,
  'P0002', 'application not found', '別的品牌不能錄取');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select lives_ok(
  format('select public.accept_application_with_collab(%L, 5000, ''IG 貼文 1 篇'')',
    (select id from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f001' and creator_id = '00000000-0000-0000-0000-000000000611')),
  '招募主可以錄取');
select is(
  (select status from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f001' and creator_id = '00000000-0000-0000-0000-000000000611'),
  'accepted', '錄取後狀態是 accepted');
select throws_ok(
  format('select public.decide_application(%L, false)',
    (select id from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f001' and creator_id = '00000000-0000-0000-0000-000000000611')),
  '55000', 'application not pending', '錄取後不能再改');
select lives_ok(
  $$select public.decide_application('00000000-0000-0000-0000-00000006a003', false)$$,
  '截止後招募主仍可以婉拒');
select is(
  (select status from public.brief_applications where id = '00000000-0000-0000-0000-00000006a003'),
  'rejected', '婉拒後狀態是 rejected');
select throws_ok(
  $$select public.decide_application('00000000-0000-0000-0000-00000006a003', null)$$,
  '22023', 'invalid accept', '必須指定錄取或婉拒');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000006a061', 5000, 'IG 貼文 1 篇')$$,
  'P0002', 'application not found', '創作者不能錄取');

-- ── G. 報名人數 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select is(
  (select applicant_count || ':' || pending_count from public.brief_application_counts(array['00000000-0000-0000-0000-00000006f006'::uuid])),
  '1:1', '人數只算 applied 與 accepted；招募主看得到待處理人數');
select is(
  (select count(*)::int from public.brief_application_counts(array['00000000-0000-0000-0000-00000006f001'::uuid])),
  0, '看不到的招募不回傳人數');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select is(
  (select applicant_count || ':' || coalesce(pending_count::text, 'null')
     from public.brief_application_counts(array['00000000-0000-0000-0000-00000006f006'::uuid])),
  '1:null', '創作者看得到人數，看不到待處理人數');
select is(
  (select count(*)::int from public.brief_application_counts(array['00000000-0000-0000-0000-00000006f004'::uuid])),
  0, '創作者看不到草稿的人數');
select is(
  (select applicant_count::int from public.brief_application_counts(array['00000000-0000-0000-0000-00000006f001'::uuid])),
  1, '已錄取也算在人數裡');

-- ── H. 機會列表 ──
-- 小美（已審核）
select is((select count(*)::int from public.list_opportunities('all')), 7, '全部：開放中未截止的 7 則');
select is((select total_count::int from public.list_opportunities('all') limit 1), 7, 'total_count 是總數');
select is((select id from public.list_opportunities('all') limit 1), '00000000-0000-0000-0000-00000006f002'::uuid, '依截止日由近到遠');
select is((select count(*)::int from public.list_opportunities('all', null, 2, 0)), 2, 'p_limit 限制筆數');
select is((select total_count::int from public.list_opportunities('all', null, 2, 0) limit 1), 7, '分頁時 total_count 仍是總數');
select is((select count(*)::int from public.list_opportunities('all', null, 20, 6)), 1, 'p_offset 跳過前面的');
select is(
  (select array_agg(id order by deadline) from public.list_opportunities('match')),
  array['00000000-0000-0000-0000-00000006f002', '00000000-0000-0000-0000-00000006f001']::uuid[],
  '適合我：只列四項都符合的');
select is((select count(*)::int from public.list_opportunities()), 2, '預設是適合我');
select is((select count(*)::int from public.list_opportunities('bogus')), 2, '不認得的篩選當成適合我');
select is(
  (select array[followers_ok, region_ok, category_ok, collab_ok]::text from public.list_opportunities('all')
    where id = '00000000-0000-0000-0000-00000006f009'), '{f,t,t,t}', '粉絲數低於門檻：只有粉絲不符合');
select is(
  (select array[followers_ok, region_ok, category_ok, collab_ok]::text from public.list_opportunities('all')
    where id = '00000000-0000-0000-0000-00000006f010'), '{t,f,t,t}', '粉絲剛好等於門檻算符合；地區不同不符合');
select is(
  (select array[followers_ok, region_ok, category_ok, collab_ok]::text from public.list_opportunities('all')
    where id = '00000000-0000-0000-0000-00000006f011'), '{t,t,f,t}', '內容領域沒有交集不符合');
select is(
  (select array[followers_ok, region_ok, category_ok, collab_ok]::text from public.list_opportunities('all')
    where id = '00000000-0000-0000-0000-00000006f012'), '{t,t,t,f}', '合作形式沒有交集不符合');
select is(
  (select is_match from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f012'),
  false, '任一項不符合 is_match 就是 false');
select is(
  (select array_agg(id order by deadline) from public.list_opportunities('cash')),
  array['00000000-0000-0000-0000-00000006f006', '00000000-0000-0000-0000-00000006f001']::uuid[],
  '現金：有預算的');
select is((select count(*)::int from public.list_opportunities('product')), 5, '互惠：提供產品的');
select is(
  (select array_agg(id) from public.list_opportunities('category', '美妝')),
  array['00000000-0000-0000-0000-00000006f001']::uuid[], '內容領域：只列明確包含的（不限的不算）');
select is((select count(*)::int from public.list_opportunities('category', '不存在的領域')), 0, '清單以外的內容領域不報錯，只是沒有結果');
select is((select count(*)::int from public.list_opportunities('category', null)), 0, '內容領域篩選沒給領域時沒有結果');
select is(
  (select has_applied::text || ':' || my_status from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f001'),
  'true:accepted', '帶出自己是否報名與狀態');
select is(
  (select has_applied from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f009'),
  false, '沒報名的是 false');
select is(
  (select applicant_count::int from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f006'),
  1, '列表的人數只算 applied 與 accepted');
select is(
  (select brand_name || ':' || brand_logo_path from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f001'),
  '品牌甲:00000000-0000-0000-0000-000000000601/logo.png', '帶出品牌名稱與 Logo 路徑');
-- 阿明：沒填想接的合作 → 合作形式不檢查
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000612","role":"authenticated"}', true);
select is(
  (select collab_ok from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f012'),
  true, '創作者沒填想接的合作時不檢查合作形式');
select is(
  (select is_match from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f006'),
  true, '阿明符合 f06');
-- 新人（未審核、沒填地區）
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000613","role":"authenticated"}', true);
select is((select count(*)::int from public.list_opportunities('all')), 7, '未審核創作者也可以瀏覽機會');
select is(
  (select region_ok from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f001'),
  false, '創作者沒填地區時，限定地區的招募不符合');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select throws_ok($$select * from public.list_opportunities('all')$$, '42501', 'not a creator', '品牌不能讀機會列表');

-- ── I. 機會詳情 ──
select throws_ok($$select * from public.get_opportunity('00000000-0000-0000-0000-00000006f001')$$, '42501', 'not a creator', '品牌不能讀機會詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select is(
  (select description || ':' || is_match::text || ':' || my_status from public.get_opportunity('00000000-0000-0000-0000-00000006f001')),
  '說明:true:accepted', '詳情帶出說明、是否符合、自己的報名');
select is((select count(*)::int from public.get_opportunity('00000000-0000-0000-0000-00000006f003')), 0, '沒報名過的已截止招募不回傳');
select is((select count(*)::int from public.get_opportunity('00000000-0000-0000-0000-00000006f004')), 0, '草稿不回傳');
select is(
  (select status from public.get_opportunity('00000000-0000-0000-0000-00000006f005')),
  'closed', '報名過的已關閉招募仍可以看詳情');

-- ── J. 報名者列表 ──
select throws_ok($$select * from public.list_brief_applicants('00000000-0000-0000-0000-00000006f001')$$, '42501', 'not brief owner', '創作者不能讀報名者');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select throws_ok($$select * from public.list_brief_applicants('00000000-0000-0000-0000-00000006f001')$$, '42501', 'not brief owner', '別的品牌不能讀報名者');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select is(
  (select handle || ':' || display_name || ':' || follower_count || ':' || status
     from public.list_brief_applicants('00000000-0000-0000-0000-00000006f001')),
  'bf_mei:小美:5000:accepted', '招募主讀得到報名者的公開資料與狀態');

-- ── K. 新增與修改招募 ──
select isnt(public.save_brief(p_title => E'  只有案名​ '), null, '草稿只要格式正確，不檢查必填');
select is(
  (select status || ':' || coalesce(published_at::text, 'null') from public.briefs where title = '只有案名'),
  'draft:null', '案名經過 clean_text；草稿沒有 published_at');
select lives_ok(
  $$select public.save_brief(p_title => '新品開箱', p_description => '說明', p_collab_types => array['IG 貼文'],
    p_budget_min_twd => 0, p_budget_max_twd => 5000, p_deadline => public.today_tw() + 7, p_publish => true)$$,
  '完整資料可以發佈');
select is(
  (select status || ':' || (published_at is not null)::text || ':' || coalesce(budget_min_twd::text, 'null')
     from public.briefs where title = '新品開箱'),
  'open:true:null', '發佈後是 open、有 published_at；預算 0 存成 null');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_description => 'y', p_includes_product => true,
    p_deadline => public.today_tw() + 7, p_publish => true)$$,
  '22023', 'invalid collab_types', '發佈時至少要有一種合作形式');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_description => 'y', p_collab_types => array['IG 貼文'],
    p_deadline => public.today_tw() + 7, p_publish => true)$$,
  '22023', 'invalid reward', '發佈時要有預算或產品');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_collab_types => array['IG 貼文'], p_includes_product => true,
    p_deadline => public.today_tw() + 7, p_publish => true)$$,
  '22023', 'invalid description', '發佈時要有說明');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_description => 'y', p_collab_types => array['IG 貼文'],
    p_includes_product => true, p_deadline => public.today_tw() - 1, p_publish => true)$$,
  '22023', 'invalid deadline', '截止日不能早於今天');
select lives_ok(
  $$select public.save_brief(p_title => '今天截止新案', p_description => 'y', p_collab_types => array['IG 貼文'],
    p_includes_product => true, p_deadline => public.today_tw(), p_publish => true)$$,
  '截止日可以是今天');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_description => 'y', p_collab_types => array['IG 貼文'],
    p_includes_product => true, p_deadline => public.today_tw() + 91, p_publish => true)$$,
  '22023', 'invalid deadline', '截止日最多 90 天後');
select lives_ok(
  $$select public.save_brief(p_title => '九十天後', p_description => 'y', p_collab_types => array['IG 貼文'],
    p_includes_product => true, p_deadline => public.today_tw() + 90, p_publish => true)$$,
  '截止日可以是 90 天後');
select throws_ok(
  $$select public.save_brief(p_title => E'a‮b')$$, '22023', 'invalid title', '案名不能有雙向控制字元');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_budget_min_twd => 5000, p_budget_max_twd => 4000)$$,
  '22023', 'invalid budget_max_twd', '預算上限不能低於下限');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_categories => array['a', 'b', 'c', 'd', 'e', 'f'])$$,
  '22023', 'invalid categories', '內容領域最多 5 個');
select throws_ok(
  $$select public.save_brief(p_title => 'x', p_cover_path => '00000000-0000-0000-0000-000000000602/cover-a.jpg')$$,
  '22023', 'invalid cover_path', '封面必須在自己的資料夾');
select lives_ok(
  $$select public.save_brief(p_title => '有封面的草稿', p_cover_path => '00000000-0000-0000-0000-000000000601/cover-a.jpg')$$,
  '封面在自己的資料夾可以');
select lives_ok(
  $$select public.save_brief(p_id => '00000000-0000-0000-0000-00000006f004', p_title => '草稿發佈', p_description => 'y',
    p_collab_types => array['Reels'], p_includes_product => true, p_deadline => public.today_tw() + 5, p_publish => true)$$,
  '草稿可以發佈');
select is((select status from public.briefs where id = '00000000-0000-0000-0000-00000006f004'), 'open', '草稿發佈後是 open');
select lives_ok(
  $$select public.save_brief(p_id => '00000000-0000-0000-0000-00000006f001', p_title => '春季保養開箱（改）', p_description => '說明',
    p_collab_types => array['IG 貼文'], p_budget_min_twd => 5000, p_deadline => public.today_tw() + 10)$$,
  '發佈中的招募可以修改');
select is(
  (select status || ':' || title from public.briefs where id = '00000000-0000-0000-0000-00000006f001'),
  'open:春季保養開箱（改）', '修改發佈中的招募不會變回草稿');
select throws_ok(
  $$select public.save_brief(p_id => '00000000-0000-0000-0000-00000006f001', p_title => 'x', p_description => 'y',
    p_collab_types => array['IG 貼文'], p_includes_product => true, p_deadline => public.today_tw() - 1)$$,
  '22023', 'invalid deadline', '發佈中的招募截止日不能改到今天以前');
select throws_ok(
  $$select public.save_brief(p_id => '00000000-0000-0000-0000-00000006f003', p_title => 'x')$$,
  '55000', 'brief not editable', '已截止的招募不能修改');
select throws_ok(
  $$select public.save_brief(p_id => '00000000-0000-0000-0000-00000006f005', p_title => 'x')$$,
  '55000', 'brief not editable', '已關閉的招募不能修改');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_brief(p_id => '00000000-0000-0000-0000-00000006f001', p_title => 'x')$$,
  'P0002', 'brief not found', '不能修改別人的招募');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
select throws_ok($$select public.save_brief(p_title => 'x')$$, '42501', 'not a brand', '創作者不能刊登招募');

-- ── L. 關閉與刪除 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select throws_ok($$select public.close_brief('00000000-0000-0000-0000-00000006f002')$$, 'P0002', 'brief not found', '不能關閉別人的招募');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
select lives_ok($$select public.close_brief('00000000-0000-0000-0000-00000006f002')$$, '招募主可以關閉發佈中的招募');
select is((select status from public.briefs where id = '00000000-0000-0000-0000-00000006f002'), 'closed', '關閉後是 closed');
select throws_ok($$select public.close_brief('00000000-0000-0000-0000-00000006f002')$$, '55000', 'brief not open', '已關閉的不能再關閉');
select is((select count(*)::int from public.brief_applications where brief_id = '00000000-0000-0000-0000-00000006f002'), 1, '關閉後報名紀錄保留');
select throws_ok($$select public.delete_brief('00000000-0000-0000-0000-00000006f001')$$, '55000', 'brief not draft', '發佈過的招募不能刪除');
select is(
  public.delete_brief((select id from public.briefs where title = '有封面的草稿')),
  '00000000-0000-0000-0000-000000000601/cover-a.jpg', '刪除草稿並回傳封面路徑');
select is((select count(*)::int from public.briefs where title = '有封面的草稿'), 0, '草稿已刪除');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select throws_ok(
  format('select public.delete_brief(%L)', (select id from public.briefs where title = '只有案名')),
  'P0002', 'brief not found', '不能刪除別人的草稿');
-- 關閉後創作者的機會列表不再出現
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000613","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.list_opportunities('all') where id = '00000000-0000-0000-0000-00000006f002'),
  0, '關閉後機會列表不再出現');

select * from finish();
rollback;
