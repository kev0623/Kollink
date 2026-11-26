begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- 841 品牌、842 另一個品牌；851、852 已審核創作者、853 停權創作者；859 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000841', 'p7r-b1@test.local'),
  ('00000000-0000-0000-0000-000000000842', 'p7r-b2@test.local'),
  ('00000000-0000-0000-0000-000000000851', 'p7r-c1@test.local'),
  ('00000000-0000-0000-0000-000000000852', 'p7r-c2@test.local'),
  ('00000000-0000-0000-0000-000000000853', 'p7r-c3@test.local'),
  ('00000000-0000-0000-0000-000000000859', 'p7r-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000841', 'brand', '讀取品牌'),
  ('00000000-0000-0000-0000-000000000842', 'brand', '另一個品牌'),
  ('00000000-0000-0000-0000-000000000851', 'creator', '讀取小美'),
  ('00000000-0000-0000-0000-000000000852', 'creator', '讀取阿哲'),
  ('00000000-0000-0000-0000-000000000853', 'creator', '讀取停權');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000859');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000841', '讀取品牌'),
  ('00000000-0000-0000-0000-000000000842', '另一個品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000851', 'p7rmei', 'p7rmei', 'approved'),
  ('00000000-0000-0000-0000-000000000852', 'p7rzhe', 'p7rzhe', 'approved'),
  ('00000000-0000-0000-0000-000000000853', 'p7rgone', 'p7rgone', 'suspended');
-- c841：有訊息；c842：品牌開了但沒傳訊息、沒有合作案；c843：停權創作者、只有合作案；c844：另一個品牌與 851
insert into public.conversations (id, brand_id, creator_id, created_at) values
  ('00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000851', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-00000008c842', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000852', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000008c843', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000853', now() - interval '4 hours'),
  ('00000000-0000-0000-0000-00000008c844', '00000000-0000-0000-0000-000000000842', '00000000-0000-0000-0000-000000000851', now() - interval '6 hours');
insert into public.messages (id, conversation_id, sender_id, body, created_at) values
  ('00000000-0000-0000-0000-00000008a001', '00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000851', '嗨', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000008a002', '00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000841', '您好', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000008a003', '00000000-0000-0000-0000-00000008c841', '00000000-0000-0000-0000-000000000851', '報價多少？', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000008a004', '00000000-0000-0000-0000-00000008c844', '00000000-0000-0000-0000-000000000842', '另一個品牌的訊息', now() - interval '30 minutes');
insert into public.collaborations
  (id, brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status) values
  ('00000000-0000-0000-0000-00000008e001', '00000000-0000-0000-0000-000000000841', '00000000-0000-0000-0000-000000000853',
   '00000000-0000-0000-0000-00000008c843', '停權前的邀約', 'x', 1000, 'invited');

-- ── 列表 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000841","role":"authenticated"}', true);
select is(
  (select string_agg(t.counterpart_name, ',' order by t.ordinality) from public.list_my_conversations() with ordinality t),
  '讀取小美,讀取停權,讀取阿哲', '品牌：依最後一則訊息（沒有就用建立時間）由新到舊，含自己開的空對話');
select is(
  (select my_side || '|' || counterpart_handle || '|' || last_body || '|' || last_sender_is_me || '|' || unread_count || '|' || closed
     from public.list_my_conversations() where id = '00000000-0000-0000-0000-00000008c841'),
  'brand|p7rmei|報價多少？|false|2|false', '最後一則訊息、未讀數（對方送的 2 則）');
select is((select closed from public.list_my_conversations() where id = '00000000-0000-0000-0000-00000008c843'),
  true, '創作者停權時對話標記為暫停');
select is(public.unread_conversation_count(), 1, '品牌有 1 個對話有未讀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000852","role":"authenticated"}', true);
select is((select count(*)::int from public.list_my_conversations()), 0, '創作者看不到品牌開了但還沒傳訊息的空對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000853","role":"authenticated"}', true);
select is((select count(*)::int from public.list_my_conversations()), 1, '有合作案的對話即使沒有訊息也看得到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000851","role":"authenticated"}', true);
select is(
  (select string_agg(t.counterpart_name || ':' || t.unread_count, ',' order by t.ordinality)
     from public.list_my_conversations() with ordinality t),
  '另一個品牌:1,讀取品牌:1', '創作者：看到品牌名稱與各自的未讀數');
select is(public.unread_conversation_count(), 2, '創作者有 2 個對話有未讀');
select lives_ok($$select public.mark_conversation_read('00000000-0000-0000-0000-00000008c841')$$, '標記已讀');
select is((select unread_count from public.list_my_conversations() where id = '00000000-0000-0000-0000-00000008c841'),
  0, '標記後未讀歸零');
select is(public.unread_conversation_count(), 1, '徽章少一個');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000842","role":"authenticated"}', true);
select is((select string_agg(id::text, ',') from public.list_my_conversations()),
  '00000000-0000-0000-0000-00000008c844', '只列自己參與的對話');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select * from public.list_my_conversations()$$, '42501', 'not authenticated', '沒有登入');

-- ── 對話標題 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000842","role":"authenticated"}', true);
select is((select count(*)::int from public.get_conversation('00000000-0000-0000-0000-00000008c841')), 0, '第三方拿不到對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000851","role":"authenticated"}', true);
select is(
  (select my_side || '|' || brand_name || '|' || creator_name || '|' || creator_handle || '|' || closed
     from public.get_conversation('00000000-0000-0000-0000-00000008c841')),
  'creator|讀取品牌|讀取小美|p7rmei|false', '創作者拿到對話標題');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000859","role":"authenticated","aal":"aal2"}', true);
select is((select my_side from public.get_conversation('00000000-0000-0000-0000-00000008c841')), 'admin', '管理員拿得到（唯讀）');

-- ── 訊息分頁 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000841","role":"authenticated"}', true);
select is(
  (select string_agg(t.body, ',' order by t.ordinality)
     from public.list_messages('00000000-0000-0000-0000-00000008c841', null, null, 2) with ordinality t),
  '報價多少？,您好', '第一頁：由新到舊');
select is(
  (select string_agg(t.body, ',' order by t.ordinality)
     from public.list_messages('00000000-0000-0000-0000-00000008c841',
            (select created_at from public.messages where id = '00000000-0000-0000-0000-00000008a002'),
            '00000000-0000-0000-0000-00000008a002', 2) with ordinality t),
  '嗨', '第二頁：從游標之後接著拿');
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841', null, null, 0)),
  1, 'p_limit 最少 1');
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841', null, null, 1000)),
  3, 'p_limit 太大時最多 100（這裡全部 3 則）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000842","role":"authenticated"}', true);
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841')), 0, '第三方拿不到訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000859","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.list_messages('00000000-0000-0000-0000-00000008c841')), 3, '管理員讀得到');

-- ── 合作案詳情帶出對話 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000841","role":"authenticated"}', true);
select is((select conversation_id from public.get_collaboration('00000000-0000-0000-0000-00000008e001')),
  '00000000-0000-0000-0000-00000008c843'::uuid, 'get_collaboration 回傳 conversation_id');
select ok(not has_function_privilege('anon', 'public.list_my_conversations()', 'EXECUTE'), 'anon 不能呼叫讀取函式');

select * from finish();
rollback;
