-- 產品只用 Email 驗證碼與 Google 登入；任何密碼登入一律拒絕（Auth hook: password_verification_attempt）。
create or replace function public.hook_reject_password(event jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('decision', 'reject', 'message', '請使用 Email 驗證碼或 Google 登入');
$$;

revoke all on function public.hook_reject_password(jsonb) from public, anon, authenticated;
grant execute on function public.hook_reject_password(jsonb) to supabase_auth_admin;
