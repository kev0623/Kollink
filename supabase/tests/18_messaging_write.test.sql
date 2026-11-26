begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

-- 801 品牌、802 第三方品牌、803 頻率限制用的品牌；811 已審核、812 待審核、813 停權創作者；819 管理員（沒有 profile）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000801', 'p7-b1@test.local'),
  ('00000000-0000-0000-0000-000000000802', 'p7-b2@test.local'),
  ('00000000-0000-0000-0000-000000000803', 'p7-b3@test.local'),
  ('00000000-0000-0000-0000-000000000811', 'p7-c1@test.local'),
  ('00000000-0000-0000-0000-000000000812', 'p7-c2@test.local'),
  ('00000000-0000-0000-0000-000000000813', 'p7-c3@test.local'),
  ('00000000-0000-0000-0000-000000000819', 'p7-admin@test.local');
insert into public.profiles (id, role, display_name) values
  ('00000000-0000-0000-0000-000000000801', 'brand', '七號品牌'),
  ('00000000-0000-0000-0000-000000000802', 'brand', '路人品牌'),
  ('00000000-0000-0000-0000-000000000803', 'brand', '灌訊息品牌'),
  ('00000000-0000-0000-0000-000000000811', 'creator', '七號小美'),
  ('00000000-0000-0000-0000-000000000812', 'creator', '七號新人'),
  ('00000000-0000-0000-0000-000000000813', 'creator', '七號停權');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000819');
insert into public.brand_profiles (user_id, brand_name) values
  ('00000000-0000-0000-0000-000000000801', '七號品牌'),
  ('00000000-0000-0000-0000-000000000802', '路人品牌'),
  ('00000000-0000-0000-0000-000000000803', '灌訊息品牌');
insert into public.creator_profiles (user_id, handle, ig_username, status) values
  ('00000000-0000-0000-0000-000000000811', 'p7mei', 'p7mei', 'approved'),
  ('00000000-0000-0000-0000-000000000812', 'p7new', 'p7new', 'pending'),
  ('00000000-0000-0000-0000-000000000813', 'p7gone', 'p7gone', 'suspended');
-- 頻率限制：31 位已審核創作者，803 已經在 24 小時內開了 30 個對話
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid, 'p7-rate' || g || '@test.local'
    from generate_series(1, 31) g;
insert into public.profiles (id, role, display_name)
  select ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid, 'creator', '量產' || g
    from generate_series(1, 31) g;
insert into public.creator_profiles (user_id, handle, ig_username, status)
  select ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid, 'p7rate' || g, 'p7rate' || g, 'approved'
    from generate_series(1, 31) g;
insert into public.conversations (brand_id, creator_id)
  select '00000000-0000-0000-0000-000000000803', ('00000000-0000-0000-0000-0000008' || lpad(g::text, 5, '0'))::uuid
    from generate_series(1, 30) g;
-- 801 與 811 已有對話（例如之前的邀約）；801 與停權的 813 也有
insert into public.conversations (id, brand_id, creator_id) values
  ('00000000-0000-0000-0000-00000008c001', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000811'),
  ('00000000-0000-0000-0000-00000008c002', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000813');

-- ── A. 權限 ──
select ok(not has_table_privilege('authenticated', 'public.messages', 'INSERT'), 'authenticated 不能直接 insert messages');
select ok(not has_column_privilege('authenticated', 'public.messages', 'body', 'INSERT'), '計畫 1 的欄位 insert 權限已收回');
select ok(not has_table_privilege('service_role', 'public.messages', 'INSERT'), 'service_role 也不能直接 insert');
select ok(not has_table_privilege('anon', 'public.messages', 'SELECT'), 'anon 讀不到 messages');
select ok(not has_table_privilege('authenticated', 'public.messages', 'UPDATE'), '沒有人能 update messages');
select ok(not has_table_privilege('authenticated', 'public.messages', 'DELETE'), '沒有人能 delete messages');
select ok(not has_function_privilege('anon', 'public.is_conversation_participant(uuid)', 'EXECUTE'),
  'anon 不能呼叫 is_conversation_participant');
select ok(has_function_privilege('authenticated', 'public.is_conversation_participant(uuid)', 'EXECUTE'),
  'authenticated 仍可呼叫（policy 與 Realtime 需要）');
select ok(exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'),
  'messages 在 supabase_realtime publication 裡');
select ok(not has_table_privilege('authenticated', 'public.conversation_reads', 'INSERT'), '已讀只能經由函式寫入');

-- ── B. 聯絡方式偵測（與 src/lib/messages/contact.test.ts 相同的案例）──
select ok(
  (select bool_and(public.has_contact_info(t)) from (values
    ('我的電話 0912-345-678'), ('０９１２３４５６７８'), ('+886 912 345 678'), ('(02) 2345-6789'), ('07-123-4567'),
    ('mail: Mei.Lin@Example.com.tw'), ('看 https://foo.bar/x'), ('www.abc.xyz'), ('line.me/ti/p/abc'), ('官網 abc.com 有'),
    ('LINE ID: mei_123'), ('ＬＩＮＥ：mei'), ('加我賴'), ('加個line吧'), ('賴: abc'), ('line@abc'),
    (E'0912\u00ad345678'), ('0912_345_678'), ('0912/345/678'), (E'加\U0001F600\U0001F600賴')) x(t)),
  '電話、Email、連結、LINE 都偵測得到');
select ok(
  (select not bool_or(public.has_contact_info(t)) from (values
    ('預算 NT$30,000 元'), ('2026-11-26 交稿'), ('deadline: 12/1'), ('online 直播'), ('line drawing 風格'),
    ('abc.comx'), ('e.g. 這樣'), ('訂單 123456789'), ('IG @mei.ig'), ('09123456789'), (E'加\n\n賴'), ('2026/11/26 交稿'), ('12/1 到 12/15')) x(t)),
  '一般內容不會誤判');

-- ── C. 開啟對話 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000811","role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000801')$$,
  '42501', 'not a brand', '創作者不能主動開啟對話');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000811')$$,
  '42501', 'not authenticated', '沒有登入不能開啟對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000812')$$,
  'P0002', 'creator not found', '不能找待審核的創作者');
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-0000000008ff')$$,
  'P0002', 'creator not found', '不存在的創作者');
select is(public.start_conversation('00000000-0000-0000-0000-000000000811'),
  '00000000-0000-0000-0000-00000008c001'::uuid, '已有對話就回傳同一個');
select is(public.start_conversation('00000000-0000-0000-0000-000000000813'),
  '00000000-0000-0000-0000-00000008c002'::uuid, '已有對話的停權創作者也回傳（畫面顯示暫停）');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select lives_ok($$select public.start_conversation('00000000-0000-0000-0000-000000000811')$$, '品牌可以找已審核的創作者');
select is((select count(*)::int from public.conversations
            where brand_id = '00000000-0000-0000-0000-000000000802' and creator_id = '00000000-0000-0000-0000-000000000811'),
  1, '建立了對話');
select is(public.start_conversation('00000000-0000-0000-0000-000000000811'),
  (select id from public.conversations
    where brand_id = '00000000-0000-0000-0000-000000000802' and creator_id = '00000000-0000-0000-0000-000000000811'),
  '再按一次回傳同一個對話');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000803","role":"authenticated"}', true);
select throws_ok($$select public.start_conversation('00000000-0000-0000-0000-000000800031')$$,
  '54000', 'too many conversations', '24 小時內最多開 30 個新對話');
select lives_ok($$select public.start_conversation('00000000-0000-0000-0000-000000800001')$$,
  '已經有的對話不受頻率限制');

-- ── D. 送出訊息 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', '插話')$$,
  'P0002', 'conversation not found', '第三方不能在別人的對話裡發訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000819","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', '我是管理員')$$,
  'P0002', 'conversation not found', '管理員不能代替參與者發訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000811","role":"authenticated"}', true);
select is((select body from public.send_message('00000000-0000-0000-0000-00000008c001', E'  你好​  ')),
  '你好', '創作者可以在既有對話裡發訊息，內文已清理');
select is((select sender_id::text from public.messages where body = '你好'),
  '00000000-0000-0000-0000-000000000811', 'sender_id 一定是呼叫者');
select is((select body from public.send_message('00000000-0000-0000-0000-00000008c001', E'第一行\r\n第二行\r第三行')),
  E'第一行\n第二行\n第三行', 'CRLF 與 CR 都換成 LF');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', E' \t\n')$$,
  '22023', 'invalid body', '空白訊息');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', repeat('字', 2001))$$,
  '22023', 'invalid body', '最多 2000 字');
select lives_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', repeat('字', 2000))$$,
  '剛好 2000 字可以');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', E'abc‮')$$,
  '22023', 'invalid body', '雙向控制字元');
select is((select flagged_contact from public.send_message('00000000-0000-0000-0000-00000008c001', '我的 LINE ID: mei_123')),
  true, '含聯絡方式的訊息仍可送出，但被標記');
select is((select flagged_contact from public.send_message('00000000-0000-0000-0000-00000008c001', '收到，謝謝')),
  false, '一般訊息沒有標記');
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('00000000-0000-0000-0000-00000008c001', '00000000-0000-0000-0000-000000000801', '冒名')$$,
  '42501', null, '不能直接 insert（也就不能偽造 sender）');
select throws_ok($$update public.messages set body = '改掉' where conversation_id = '00000000-0000-0000-0000-00000008c001'$$,
  '42501', null, '不能修改訊息');
select throws_ok($$delete from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'$$,
  '42501', null, '不能刪除訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c002', '還在嗎')$$,
  '55000', 'conversation closed', '創作者停權時品牌不能送');
select lives_ok(
  $$select public.send_message('00000000-0000-0000-0000-00000008c001', '第 ' || g || ' 則') from generate_series(1, 20) g$$,
  '1 分鐘內 20 則可以');
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c001', '第 21 則')$$,
  '54000', 'too many messages', '第 21 則被頻率限制擋下');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000813","role":"authenticated"}', true);
select throws_ok($$select * from public.send_message('00000000-0000-0000-0000-00000008c002', '我回來了')$$,
  '55000', 'conversation closed', '停權的創作者也不能送');

-- ── E. 已讀 ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select throws_ok($$select public.mark_conversation_read('00000000-0000-0000-0000-00000008c001')$$,
  'P0002', 'conversation not found', '第三方不能標記已讀');
select lives_ok(
  $$select public.mark_conversation_read(cv.id) from public.conversations cv
     where cv.creator_id = '00000000-0000-0000-0000-000000000811'$$,
  '沒有訊息的對話也可以標記（不寫入）');
select is((select count(*)::int from public.conversation_reads), 0, '沒有訊息時不寫已讀');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000811","role":"authenticated"}', true);
select lives_ok($$select public.mark_conversation_read('00000000-0000-0000-0000-00000008c001')$$, '參與者可以標記已讀');
select is((select last_read_at from public.conversation_reads
            where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  (select max(created_at) from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  '已讀時間 = 最後一則訊息的時間');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select is((select count(*)::int from public.conversation_reads), 0, '只讀得到自己的已讀紀錄');

-- ── F. 可見性 ──
select is((select count(*)::int from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  25, '參與者看得到對話裡的訊息');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select is((select count(*)::int from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001'),
  0, '第三方看不到');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000819","role":"authenticated"}', true);
select is((select count(*)::int from public.messages where conversation_id = '00000000-0000-0000-0000-00000008c001' and flagged_contact),
  1, '管理員看得到被標記的訊息');

-- ── G. trigger：任何路徑寫入都重新計算 ──
reset role;
insert into public.messages (conversation_id, sender_id, body, flagged_contact) values
  ('00000000-0000-0000-0000-00000008c001', '00000000-0000-0000-0000-000000000801', 'mail me: a@b.co', false);
select is((select flagged_contact from public.messages where body = 'mail me: a@b.co'), true,
  '擁有者直接 insert 時 flagged_contact 也由 trigger 決定');

select * from finish();
rollback;
