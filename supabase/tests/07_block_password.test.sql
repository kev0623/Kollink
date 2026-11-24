begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is(public.hook_reject_password('{}'::jsonb)->>'decision', 'reject', '一律拒絕');
select is(public.hook_reject_password('{"valid":true}'::jsonb)->>'message', '請使用 Email 驗證碼或 Google 登入', '訊息');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_reject_password(jsonb)', 'execute'), 'auth admin 可執行');
select ok(not has_function_privilege('anon', 'public.hook_reject_password(jsonb)', 'execute'), 'anon 不可執行');
select ok(not has_function_privilege('authenticated', 'public.hook_reject_password(jsonb)', 'execute'), 'authenticated 不可執行');

insert into auth.users (id, email, encrypted_password) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local', 'hash-should-vanish');
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-0000000000f1'), null, 'insert 帶密碼 -> 存 null');

update auth.users set encrypted_password = 'another-hash' where id = '00000000-0000-0000-0000-0000000000f1';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-0000000000f1'), null, 'update 密碼 -> 存 null');

update auth.users set encrypted_password = crypt('Passw0rd!x', gen_salt('bf')) where id = '00000000-0000-0000-0000-0000000000f1';
select is((select encrypted_password from auth.users where id = '00000000-0000-0000-0000-0000000000f1'), null, 'bcrypt 雜湊也存 null');

select ok(not has_function_privilege('authenticated', 'public.null_encrypted_password()', 'execute'), 'trigger 函式不開放給 authenticated');

select * from finish();
rollback;
