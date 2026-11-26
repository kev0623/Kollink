-- LINE 登入：20261130000100_line_identities.sql。id 前綴 …0000000e6xxx。
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000e6001', 'line-a@test.local'),
  ('00000000-0000-0000-0000-0000000e6002', 'Line-B@Test.Local'),
  ('00000000-0000-0000-0000-0000000e6003', 'line-c@test.local');

-- ── 權限：API 角色碰不到資料表；函式只給 service_role ──
select ok((select relrowsecurity from pg_class where oid = 'public.line_identities'::regclass), 'RLS 已開啟');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'line_identities'), 0, '沒有任何 policy');
select ok(not has_table_privilege('anon', 'public.line_identities', 'SELECT'), 'anon 不能讀');
select ok(not has_table_privilege('authenticated', 'public.line_identities', 'SELECT'), 'authenticated 不能讀');
select ok(not has_table_privilege('authenticated', 'public.line_identities', 'INSERT'), 'authenticated 不能寫');
select ok(not has_table_privilege('service_role', 'public.line_identities', 'SELECT'), 'service_role 也不能直接讀（只能透過函式）');
select ok(not has_table_privilege('service_role', 'public.line_identities', 'INSERT'), 'service_role 也不能直接寫');
select ok(not has_function_privilege('anon', 'public.line_login_lookup(text, text)', 'EXECUTE'), 'anon 不能查');
select ok(not has_function_privilege('authenticated', 'public.line_login_lookup(text, text)', 'EXECUTE'), 'authenticated 不能查');
select ok(not has_function_privilege('anon', 'public.line_link_identity(uuid, text)', 'EXECUTE'), 'anon 不能綁定');
select ok(not has_function_privilege('authenticated', 'public.line_link_identity(uuid, text)', 'EXECUTE'), 'authenticated 不能綁定');
select ok(has_function_privilege('service_role', 'public.line_login_lookup(text, text)', 'EXECUTE'), 'service_role 可以查');
select ok(has_function_privilege('service_role', 'public.line_link_identity(uuid, text)', 'EXECUTE'), 'service_role 可以綁定');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000e6001","role":"authenticated"}', true);
select throws_ok($$select * from public.line_identities$$, '42501', null, '登入的使用者讀不到');
select throws_ok($$select public.line_link_identity('00000000-0000-0000-0000-0000000e6001', 'U00000000000000000000000000000001')$$,
  '42501', null, '登入的使用者不能自己綁定');
reset role;

-- ── 函式行為（service_role）──
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((select row(linked_user_id, email_user_id)::text from public.line_login_lookup('U00000000000000000000000000000001', ' line-b@test.local ')),
  row(null::uuid, '00000000-0000-0000-0000-0000000e6002'::uuid)::text, '沒綁定；Email 不分大小寫、去空白找到帳號');
select is((select row(linked_user_id, email_user_id)::text from public.line_login_lookup('U00000000000000000000000000000001', null)),
  row(null::uuid, null::uuid)::text, '沒有 Email：兩個都是 null');
select is(public.line_link_identity('00000000-0000-0000-0000-0000000e6001', 'U00000000000000000000000000000001'), 'linked', '綁定成功');
select is(public.line_link_identity('00000000-0000-0000-0000-0000000e6001', 'U00000000000000000000000000000001'), 'already', '重複綁定同一組：already');
select is(public.line_link_identity('00000000-0000-0000-0000-0000000e6002', 'U00000000000000000000000000000001'), 'sub_taken', '這個 LINE 已綁別的帳號');
select is(public.line_link_identity('00000000-0000-0000-0000-0000000e6001', 'U00000000000000000000000000000002'), 'user_has_other', '這個帳號已綁別的 LINE');
select is((select linked_user_id from public.line_login_lookup('U00000000000000000000000000000001', 'nobody@test.local')),
  '00000000-0000-0000-0000-0000000e6001'::uuid, '查得到已綁定的帳號');
select throws_ok($$select public.line_link_identity('00000000-0000-0000-0000-0000000e6003', 'not-a-line-id')$$, '22023', null, 'LINE ID 格式不對');
reset role;

-- ── 刪除帳號時一起刪掉綁定 ──
delete from auth.users where id = '00000000-0000-0000-0000-0000000e6001';
select is((select count(*)::int from public.line_identities where line_sub = 'U00000000000000000000000000000001'), 0, '帳號刪除後綁定也刪除');
select throws_ok($$insert into public.line_identities (user_id, line_sub) values ('00000000-0000-0000-0000-0000000e6003', 'u0000')$$,
  '23514', null, 'check：LINE ID 必須是 U＋32 位十六進位');

select * from finish();
rollback;
