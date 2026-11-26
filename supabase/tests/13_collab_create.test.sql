begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- 701、702 品牌；711、712 已審核創作者；713 待審核創作者
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000701', 'p6-b1@test.local'),
  ('00000000-0000-0000-0000-000000000702', 'p6-b2@test.local'),
  ('00000000-0000-0000-0000-000000000711', 'p6-c1@test.local'),
  ('00000000-0000-0000-0000-000000000712', 'p6-c2@test.local'),
  ('00000000-0000-0000-0000-000000000713', 'p6-c3@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000701', 'brand', '六號品牌'),
  ('00000000-0000-0000-0000-000000000702', 'brand', '別的品牌'),
  ('00000000-0000-0000-0000-000000000711', 'creator', '六號小美'),
  ('00000000-0000-0000-0000-000000000712', 'creator', '六號阿哲'),
  ('00000000-0000-0000-0000-000000000713', 'creator', '六號新人');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000701', '六號品牌'),
  ('00000000-0000-0000-0000-000000000702', '別的品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000711', 'p6mei', 'p6mei', 'approved'),
  ('00000000-0000-0000-0000-000000000712', 'p6zhe', 'p6zhe', 'approved'),
  ('00000000-0000-0000-0000-000000000713', 'p6new', 'p6new', 'pending');
insert into public.briefs
  (id, brand_id, title, description, collab_types, includes_product, deadline, status, published_at) values
  ('00000000-0000-0000-0000-00000007f001', '00000000-0000-0000-0000-000000000701',
   '六號招募', '說明', array['IG 貼文'], true, public.today_tw() + 7, 'open', now());
insert into public.brief_applications (id, brief_id, creator_id, proposed_price_twd) values
  ('00000000-0000-0000-0000-00000007a001', '00000000-0000-0000-0000-00000007f001', '00000000-0000-0000-0000-000000000711', 6000),
  ('00000000-0000-0000-0000-00000007a002', '00000000-0000-0000-0000-00000007f001', '00000000-0000-0000-0000-000000000712', null);
-- 701 與 712 之前就有對話：邀請時要沿用
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c001', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000712');

-- ── A. 不能直接建立 ──
select ok(not has_table_privilege('service_role', 'public.collaborations', 'INSERT'), 'service_role 不能直接 insert collaborations');
select ok(not has_column_privilege('authenticated', 'public.collaborations', 'title', 'INSERT'), '計畫 1 的欄位 insert 權限已收回');
select ok(not has_table_privilege('anon', 'public.conversations', 'INSERT'), 'anon 不能 insert conversations');
select ok(not has_table_privilege('service_role', 'public.conversations', 'INSERT'), 'service_role 不能直接 insert conversations');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.collaborations (brand_id, creator_id, conversation_id, title, deliverables, amount_twd)
    values ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000712',
            '00000000-0000-0000-0000-00000007c001', 'x', 'x', 1000)$$,
  '42501', null, '品牌不能直接 insert collaborations');
select throws_ok(
  $$insert into public.conversations (brand_id, creator_id)
    values ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000711')$$,
  '42501', null, '品牌不能直接 insert conversations');

-- ── B. 錄取並建立合作案 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  'P0002', 'application not found', '別的品牌不能錄取');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  'P0002', 'application not found', '創作者不能錄取');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  '42501', 'not authenticated', '沒有登入不能錄取');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 0, 'IG 貼文 1 篇')$$,
  '22023', 'invalid amount_twd', '金額不能是 0');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 10000001, 'IG 貼文 1 篇')$$,
  '22023', 'invalid amount_twd', '金額不能超過 10,000,000');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, E' \t')$$,
  '22023', 'invalid deliverables', '交付內容必填');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, repeat('字', 1001))$$,
  '22023', 'invalid deliverables', '交付內容最多 1000 字');
select is(
  (select status from public.brief_applications where id = '00000000-0000-0000-0000-00000007a001'),
  'applied', '格式錯誤時報名維持待處理（同一個 transaction）');
select lives_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, ' IG 貼文 1 篇 ')$$,
  '招募主可以錄取並建立合作案');
select is(
  (select status from public.brief_applications where id = '00000000-0000-0000-0000-00000007a001'),
  'accepted', '報名改為已錄取');
select is(
  (select status::text || '|' || amount_twd || '|' || title || '|' || deliverables || '|' || brief_id::text
     from public.collaborations where creator_id = '00000000-0000-0000-0000-000000000711'),
  'awaiting_payment|6000|六號招募|IG 貼文 1 篇|00000000-0000-0000-0000-00000007f001',
  '合作案從確認開始、案名是招募名稱、交付內容已清理');
select is(
  (select count(*)::int from public.conversations
    where brand_id = '00000000-0000-0000-0000-000000000701' and creator_id = '00000000-0000-0000-0000-000000000711'),
  1, '同時建立對話');
select is(
  (select l.actor_kind || '|' || l.to_status::text from public.audit_logs l
     join public.collaborations c on c.id = l.collaboration_id
    where c.creator_id = '00000000-0000-0000-0000-000000000711' and l.action = 'create'),
  'brand|awaiting_payment', '建立紀錄寫進 audit log（品牌）');
select is(
  (select collaboration_id from public.list_brief_applicants('00000000-0000-0000-0000-00000007f001')
    where creator_id = '00000000-0000-0000-0000-000000000711'),
  (select id from public.collaborations where creator_id = '00000000-0000-0000-0000-000000000711'),
  '報名者列表帶出合作案 id');
select is(
  (select count(*)::int from public.list_brief_applicants('00000000-0000-0000-0000-00000007f001')
    where collaboration_id is null),
  1, '沒錄取的報名者沒有合作案 id');
select throws_ok(
  $$select public.accept_application_with_collab('00000000-0000-0000-0000-00000007a001', 6000, 'IG 貼文 1 篇')$$,
  '55000', 'application not pending', '同一則報名不能再錄取一次');
select throws_ok(
  $$select public.decide_application('00000000-0000-0000-0000-00000007a002', true)$$,
  '22023', 'invalid accept', '舊的錄取路徑已收回');
select lives_ok(
  $$select public.decide_application('00000000-0000-0000-0000-00000007a002', false)$$,
  '婉拒照舊');
reset role;
select throws_ok(
  $$insert into public.collaborations (brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd)
    select '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000711',
           '00000000-0000-0000-0000-00000007f001', cv.id, 'x', 'x', 1
      from public.conversations cv
     where cv.brand_id = '00000000-0000-0000-0000-000000000701' and cv.creator_id = '00000000-0000-0000-0000-000000000711'$$,
  '23505', null, '同一則報名（招募 × 創作者）在資料庫層也只能有一個合作案');

-- ── C. 直接邀請 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711","role":"authenticated"}', true);
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '邀約', 'Reels 1 支', 3000)$$,
  '42501', 'not a brand', '創作者不能邀請');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000713', '邀約', 'Reels 1 支', 3000)$$,
  'P0002', 'creator not found', '不能邀請待審核的創作者');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-0000000007ff', '邀約', 'Reels 1 支', 3000)$$,
  'P0002', 'creator not found', '不存在的創作者');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', ' ', 'Reels 1 支', 3000)$$,
  '22023', 'invalid title', '案名必填');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', repeat('案', 61), 'Reels 1 支', 3000)$$,
  '22023', 'invalid title', '案名最多 60 字');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '邀約', 'Reels 1 支', null)$$,
  '22023', 'invalid amount_twd', '金額必填');
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '夏季邀約', 'Reels 1 支', 3000)$$,
  '品牌可以邀請已審核的創作者');
select is(
  (select status::text || '|' || coalesce(brief_id::text, 'null') || '|' || conversation_id::text
     from public.collaborations where title = '夏季邀約'),
  'invited|null|00000000-0000-0000-0000-00000007c001', '狀態是邀約、沒有招募、沿用既有對話');
select throws_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '再一次', 'Reels 1 支', 3000)$$,
  '23505', 'already invited', '已有邀約中的合作案不能再邀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000712","role":"authenticated"}', true);
select is(
  (select public.transition_collaboration(c.id, 'decline') from public.collaborations c where c.title = '夏季邀約'),
  'declined'::public.collab_status, '創作者婉拒');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '再一次', 'Reels 1 支', 3000)$$,
  '婉拒後可以再邀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated"}', true);
select lives_ok(
  $$select public.invite_creator('00000000-0000-0000-0000-000000000712', '別的品牌的邀約', 'Reels 1 支', 3000)$$,
  '別的品牌不受影響');

select * from finish();
rollback;
