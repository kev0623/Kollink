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

-- 第二層（不受方案限制）：auth.users 永遠不保存密碼雜湊，即使 hook 沒啟用也無法用密碼登入。
create or replace function public.null_encrypted_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is not null and new.encrypted_password <> '' then
    new.encrypted_password := null;
  end if;
  return new;
end;
$$;

revoke all on function public.null_encrypted_password() from public, anon, authenticated;

drop trigger if exists null_encrypted_password on auth.users;
create trigger null_encrypted_password
  before insert or update of encrypted_password on auth.users
  for each row execute function public.null_encrypted_password();
