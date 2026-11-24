begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(public.hook_reject_password('{}'::jsonb)->>'decision', 'reject', '一律拒絕');
select is(public.hook_reject_password('{"valid":true}'::jsonb)->>'message', '請使用 Email 驗證碼或 Google 登入', '訊息');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_reject_password(jsonb)', 'execute'), 'auth admin 可執行');
select ok(not has_function_privilege('anon', 'public.hook_reject_password(jsonb)', 'execute'), 'anon 不可執行');
select ok(not has_function_privilege('authenticated', 'public.hook_reject_password(jsonb)', 'execute'), 'authenticated 不可執行');

select * from finish();
rollback;
