begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- 741 品牌、742 旁觀品牌、743 自動通過用的品牌；751、752 創作者；759 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000741', 'p6r-b1@test.local'),
  ('00000000-0000-0000-0000-000000000742', 'p6r-b2@test.local'),
  ('00000000-0000-0000-0000-000000000743', 'p6r-b3@test.local'),
  ('00000000-0000-0000-0000-000000000751', 'p6r-c1@test.local'),
  ('00000000-0000-0000-0000-000000000752', 'p6r-c2@test.local'),
  ('00000000-0000-0000-0000-000000000759', 'p6r-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000741', 'brand', '列表品牌'),
  ('00000000-0000-0000-0000-000000000742', 'brand', '旁觀品牌'),
  ('00000000-0000-0000-0000-000000000743', 'brand', '自動品牌'),
  ('00000000-0000-0000-0000-000000000751', 'creator', '列表小美'),
  ('00000000-0000-0000-0000-000000000752', 'creator', '待審阿哲');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000759');
insert into public.brand_profiles (user_id, brand_name, logo_path) values
  ('00000000-0000-0000-0000-000000000741', '列表品牌', null),
  ('00000000-0000-0000-0000-000000000742', '旁觀品牌', null),
  ('00000000-0000-0000-0000-000000000743', '自動品牌', null);
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000751', 'p6list', 'p6list', 'approved'),
  ('00000000-0000-0000-0000-000000000752', 'p6pending', 'p6pending', 'pending');
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000007c041', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751'),
  ('00000000-0000-0000-0000-00000007c042', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000752'),
  ('00000000-0000-0000-0000-00000007c043', '00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000751');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status, review_due_at, updated_at) values
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f1 邀約', 'x', 1000, 'invited', null, now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f2 待付款', 'x', 1000, 'awaiting_payment', null, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000007e3', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f3 審核', 'x', 1000, 'in_review', now() + interval '2 days', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000007e4', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f4 完成', 'x', 1000, 'completed', null, now()),
  ('00000000-0000-0000-0000-0000000007e5', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c041', 'f5 取消', 'x', 1000, 'cancelled', null, now()),
  ('00000000-0000-0000-0000-0000000007e6', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000752',
   '00000000-0000-0000-0000-00000007c042', 'f6 婉拒', 'x', 1000, 'declined', null, now()),
  ('00000000-0000-0000-0000-0000000007e7', '00000000-0000-0000-0000-000000000741', '00000000-0000-0000-0000-000000000752',
   '00000000-0000-0000-0000-00000007c042', 'f7 撥款', 'x', 1000, 'awaiting_payout', null, now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000007e8', '00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c043', 'f8 逾期', 'x', 1000, 'in_review', now() - interval '1 minute', now()),
  ('00000000-0000-0000-0000-0000000007e9', '00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000751',
   '00000000-0000-0000-0000-00000007c043', 'f9 未到期', 'x', 1000, 'in_review', now() + interval '1 hour', now());

select is(public.collab_turn('in_review'), 'brand', '審核輪到品牌（與 TS 的 turnOf 相同）');

-- ── 列表 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741","role":"authenticated"}', true);
select is(
  (select string_agg(t.title, ',' order by t.ordinality) from public.list_my_collaborations('active') with ordinality t),
  'f3 審核,f2 待付款,f1 邀約,f7 撥款', '品牌：輪到我的在前，其次依更新時間');
select is((select count(*)::int from public.list_my_collaborations('completed')), 1, '已完成分頁');
select is((select count(*)::int from public.list_my_collaborations('cancelled')), 2, '已取消分頁含婉拒');
select is((select count(*)::int from public.list_my_collaborations('垃圾')), 4, '不認得的分頁當成進行中');
select is(
  (select my_side || '|' || my_turn || '|' || counterpart_name || '|' || counterpart_handle
     from public.list_my_collaborations('active') where title = 'f3 審核'),
  'brand|true|列表小美|p6list', '品牌看到對方創作者的名稱與 handle');
select is(
  (select counterpart_name from public.list_my_collaborations('active') where title = 'f7 撥款'),
  '待審阿哲', '待審核創作者的名稱也帶得出來');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000751","role":"authenticated"}', true);
select is(
  (select string_agg(t.title, ',' order by t.ordinality) from public.list_my_collaborations('active') with ordinality t),
  'f1 邀約,f8 逾期,f9 未到期,f3 審核,f2 待付款', '創作者：輪到我的在前');
select is(
  (select my_side || '|' || counterpart_name || '|' || coalesce(counterpart_handle, 'null')
     from public.list_my_collaborations('active') where title = 'f1 邀約'),
  'creator|列表品牌|null', '創作者看到品牌名稱');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000742","role":"authenticated"}', true);
select is((select count(*)::int from public.list_my_collaborations('active')), 0, '第三人的列表是空的');

-- ── 詳情 ──
select is((select count(*)::int from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')), 0, '第三人拿不到詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741","role":"authenticated"}', true);
select is(
  (select my_side || '|' || brand_name || '|' || creator_name || '|' || creator_handle || '|' || coalesce(brief_title, 'null')
     from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')),
  'brand|列表品牌|列表小美|p6list|null', '品牌拿到詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000751","role":"authenticated"}', true);
select is((select my_side from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')), 'creator', '創作者拿到詳情');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000759","role":"authenticated"}', true);
select is((select my_side from public.get_collaboration('00000000-0000-0000-0000-0000000007e2')), 'admin', '管理員拿到詳情');

-- ── 系統事件 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000751","role":"authenticated"}', true);
select is(public.transition_collaboration('00000000-0000-0000-0000-0000000007e1', 'accept'),
  'awaiting_payment'::public.collab_status, '創作者接受邀約');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741","role":"authenticated"}', true);
select is(
  (select string_agg(action || ':' || actor_kind || ':' || actor_name, ',' order by id)
     from public.list_collaboration_events('00000000-0000-0000-0000-0000000007e1')),
  'create:system:系統,accept:creator:列表小美', '事件附上做事的人的名稱');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000742","role":"authenticated"}', true);
select is((select count(*)::int from public.list_collaboration_events('00000000-0000-0000-0000-0000000007e1')), 0, '第三人拿不到事件');

-- ── 自動通過 ──
select throws_ok($$select * from public.auto_approve_due()$$, '42501', null, '一般使用者不能呼叫自動通過');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok((select approved from public.auto_approve_due()) >= 1, 'service_role 呼叫自動通過，回傳處理件數');
select is((select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007e8'),
  'awaiting_publish', '逾期的審核自動通過');
select is((select status::text from public.collaborations where id = '00000000-0000-0000-0000-0000000007e9'),
  'in_review', '還沒到期的不動');
select is(
  (select actor_kind from public.audit_logs where collaboration_id = '00000000-0000-0000-0000-0000000007e8' and action = 'auto_approve'),
  'system', '自動通過記為系統');

select * from finish();
rollback;
