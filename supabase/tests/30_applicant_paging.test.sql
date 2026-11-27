-- 報名者列表分頁：20261201000100_applicant_paging.sql。id 前綴 …0000000f1xxx，handle pgtest_*。
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- f1001 招募主、f1002 別的品牌；f1100–f1154 共 55 位已審核創作者，全部報名 f1f01；f1f02 沒有人報名
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f1001', 'pg-b1@test.local'),
  ('00000000-0000-0000-0000-0000000f1002', 'pg-b2@test.local');
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000f1' || n)::uuid, 'pg-c' || n || '@test.local' from generate_series(100, 154) n;
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-0000000f1001', 'brand', '分頁品牌'),
  ('00000000-0000-0000-0000-0000000f1002', 'brand', '別的品牌');
insert into public.profiles (id, role, display_name)
  select ('00000000-0000-0000-0000-0000000f1' || n)::uuid, 'creator', '分頁創作者' || n from generate_series(100, 154) n;
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000f1001', '分頁品牌'),
  ('00000000-0000-0000-0000-0000000f1002', '別的品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status)
  select ('00000000-0000-0000-0000-0000000f1' || n)::uuid, 'pgtest_' || n, 'pgtest_' || n, 'approved' from generate_series(100, 154) n;
insert into public.briefs (id, brand_id, title, description, collab_types, includes_product, deadline, status, published_at) values
  ('00000000-0000-0000-0000-0000000f1f01', '00000000-0000-0000-0000-0000000f1001', '分頁招募', '說明', array['IG 貼文'], true, public.today_tw() + 7, 'open', now()),
  ('00000000-0000-0000-0000-0000000f1f02', '00000000-0000-0000-0000-0000000f1001', '沒人報名', '說明', array['IG 貼文'], true, public.today_tw() + 7, 'open', now());
-- 狀態：n%5 = 0 已婉拒（11）、1 已錄取（11）、2 已撤回（11）、其他待處理（22）。
-- 時間：每人差一分鐘；n = 150–154 故意同一個時間（測試同時間依 id 排序）。
insert into public.brief_applications (id, brief_id, creator_id, status, created_at)
  select ('00000000-0000-0000-0000-0000000f1a' || lpad((n - 100)::text, 2, '0'))::uuid,
         '00000000-0000-0000-0000-0000000f1f01',
         ('00000000-0000-0000-0000-0000000f1' || n)::uuid,
         case n % 5 when 0 then 'rejected' when 1 then 'accepted' when 2 then 'withdrawn' else 'applied' end,
         timestamptz '2026-01-01 00:00:00+00' + least(n, 150) * interval '1 minute'
    from generate_series(100, 154) n;

-- ── 權限 ──
select ok(not has_function_privilege('anon', 'public.list_brief_applicants_page(uuid, text, integer, integer)', 'EXECUTE'), 'anon 不能呼叫分頁列表');
select ok(has_function_privilege('authenticated', 'public.list_brief_applicants_page(uuid, text, integer, integer)', 'EXECUTE'), 'authenticated 可以呼叫分頁列表');
select ok(not has_function_privilege('service_role', 'public.list_brief_applicants_page(uuid, text, integer, integer)', 'EXECUTE'), 'service_role 不能呼叫分頁列表');
select ok(not has_function_privilege('anon', 'public.brief_applicant_status_counts(uuid)', 'EXECUTE'), 'anon 不能呼叫人數');
select ok(has_function_privilege('authenticated', 'public.brief_applicant_status_counts(uuid)', 'EXECUTE'), 'authenticated 可以呼叫人數');
select ok(not has_function_privilege('service_role', 'public.brief_applicant_status_counts(uuid)', 'EXECUTE'), 'service_role 不能呼叫人數');

set local role authenticated;
-- 別的品牌
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000f1002","role":"authenticated"}', true);
select throws_ok($$select * from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01')$$, '42501', 'not brief owner', '別的品牌看不到報名者');
select throws_ok($$select * from public.brief_applicant_status_counts('00000000-0000-0000-0000-0000000f1f01')$$, '42501', 'not brief owner', '別的品牌看不到人數');
-- 報名的創作者
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000f1100","role":"authenticated"}', true);
select throws_ok($$select * from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01')$$, '42501', 'not brief owner', '創作者看不到其他報名者');
select throws_ok($$select * from public.brief_applicant_status_counts('00000000-0000-0000-0000-0000000f1f01')$$, '42501', 'not brief owner', '創作者看不到人數');
-- 沒有登入身分
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select * from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01')$$, '42501', 'not brief owner', '沒有 uid 時拒絕');
-- 不存在的招募
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000f1001","role":"authenticated"}', true);
select throws_ok($$select * from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1fff')$$, '42501', 'not brief owner', '不存在的招募與別人的招募同一個錯誤');

-- ── 分頁（招募主）──
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01')), 20, '預設一頁 20 筆');
select is(
  (select array_agg(id order by ord) from (select id, row_number() over () as ord from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 5, 0)) t),
  array['00000000-0000-0000-0000-0000000f1a50', '00000000-0000-0000-0000-0000000f1a51', '00000000-0000-0000-0000-0000000f1a52',
        '00000000-0000-0000-0000-0000000f1a53', '00000000-0000-0000-0000-0000000f1a54']::uuid[],
  '新的在前；同一個時間依 id');
select is(
  (select array_agg(id order by ord) from (select id, row_number() over () as ord from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 3, 5)) t),
  array['00000000-0000-0000-0000-0000000f1a49', '00000000-0000-0000-0000-0000000f1a48', '00000000-0000-0000-0000-0000000f1a47']::uuid[],
  '接著依時間由新到舊');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 20, 20)), 20, '第二頁 20 筆');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 20, 40)), 15, '第三頁 15 筆');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 20, 60)), 0, '超過最後一頁是空的，不報錯');
select is(
  (select count(distinct id)::int from (
     select id from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 20, 0)
     union all select id from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 20, 20)
     union all select id from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 20, 40)) t),
  55, '三頁合起來是全部 55 人，沒有重複或漏掉');
select is(
  (select array_agg(id order by ord) from (select id, row_number() over () as ord from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 50, 0)) t),
  (select array_agg(id order by ord) from (select id, row_number() over () as ord from public.list_brief_applicants('00000000-0000-0000-0000-0000000f1f01') limit 50) t),
  '順序與舊函式相同');

-- ── 篩選 ──
select is(
  (select count(*)::int || '|' || count(*) filter (where status = 'applied')::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', 'applied', 50, 0)),
  '22|22', '待處理 22 人，全部是 applied');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', 'accepted', 50, 0)), 11, '已錄取 11 人');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', 'rejected', 50, 0)), 11, '已婉拒 11 人');
select is(
  (select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', 'all', 50, 0))
  + (select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', 'withdrawn', 50, 0))
  + (select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', $$' or 1=1 --$$, 50, 0)),
  150, '不認得的篩選值（all、withdrawn、奇怪的字串）都當成全部');

-- ── 參數夾住 ──
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 1000, 0)), 50, 'limit 上限 50');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 0, 0)), 1, 'limit 下限 1');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, null, null)), 20, 'null 當成預設值');
select is(
  (select id from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f01', null, 1, -5)),
  '00000000-0000-0000-0000-0000000f1a50'::uuid, '負的 offset 當成 0');

-- ── 人數 ──
select is(
  (select row(all_count, applied_count, accepted_count, rejected_count)::text from public.brief_applicant_status_counts('00000000-0000-0000-0000-0000000f1f01')),
  '(55,22,11,11)', '各狀態人數（全部含已撤回）');
select is(
  (select row(all_count, applied_count, accepted_count, rejected_count)::text from public.brief_applicant_status_counts('00000000-0000-0000-0000-0000000f1f02')),
  '(0,0,0,0)', '沒有人報名也回傳一列 0');
select is((select count(*)::int from public.list_brief_applicants_page('00000000-0000-0000-0000-0000000f1f02')), 0, '沒有人報名的招募是空列表');
reset role;

select * from finish();
rollback;
