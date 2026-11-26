-- LINE 登入（社群登入，做法 B：網站自己的 LINE 路由）。
-- LINE 使用者 ID（ID token 的 sub，同一個 LINE Login 頻道內固定）與 Kollink 帳號的一對一對應。
-- 只有伺服器（/auth/line/* 路由，service_role）透過下面兩個 definer 函式讀寫；API 角色（anon、authenticated、service_role）
-- 對資料表本身沒有任何權限。只新增資料表與函式，不改任何既有物件：舊版網站不受影響。

create table public.line_identities (
  user_id uuid primary key references auth.users (id) on delete cascade,
  line_sub text not null unique check (line_sub ~ '^U[0-9a-f]{32}$'),
  linked_at timestamptz not null default now()
);
alter table public.line_identities enable row level security;
-- 沒有任何 policy：即使之後誤加了 grant，RLS 仍然擋住所有列
revoke all on table public.line_identities from public, anon, authenticated, service_role;

-- 登入時查詢：這個 LINE 使用者已經綁定的帳號、以及這個 Email 已經存在的帳號（都可能是 null）。
-- Email 只用來決定畫面提示與要不要建立新帳號；真正綁定前一定要先通過寄到該 Email 的驗證碼。
create function public.line_login_lookup(p_line_sub text, p_email text)
returns table (linked_user_id uuid, email_user_id uuid)
language sql stable security definer set search_path = '' as $$
  select
    (select li.user_id from public.line_identities li where li.line_sub = p_line_sub),
    (select u.id from auth.users u
      where p_email is not null and btrim(p_email) <> ''
        and lower(u.email) = lower(btrim(p_email))
        and u.is_sso_user = false and u.deleted_at is null
      order by u.created_at limit 1);
$$;
revoke execute on function public.line_login_lookup(text, text) from public, anon, authenticated, service_role;
grant execute on function public.line_login_lookup(text, text) to service_role;

-- 綁定：只在使用者已經用 Email 驗證碼證明擁有該 Email 之後由伺服器呼叫。
-- 回傳 linked（新綁定）、already（同一組已綁定）、sub_taken（這個 LINE 已綁定別的帳號）、
-- user_has_other（這個帳號已綁定別的 LINE）、conflict（同時寫入的競爭，請重試）。
create function public.line_link_identity(p_user_id uuid, p_line_sub text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_sub text;
begin
  if p_user_id is null or p_line_sub is null or p_line_sub !~ '^U[0-9a-f]{32}$' then
    raise exception 'line_link_identity: invalid arguments' using errcode = '22023';
  end if;
  select li.user_id into v_user from public.line_identities li where li.line_sub = p_line_sub;
  if found then
    return case when v_user = p_user_id then 'already' else 'sub_taken' end;
  end if;
  select li.line_sub into v_sub from public.line_identities li where li.user_id = p_user_id;
  if found then
    return 'user_has_other';
  end if;
  insert into public.line_identities (user_id, line_sub) values (p_user_id, p_line_sub) on conflict do nothing;
  if not found then
    return 'conflict';
  end if;
  return 'linked';
end;
$$;
revoke execute on function public.line_link_identity(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.line_link_identity(uuid, text) to service_role;
