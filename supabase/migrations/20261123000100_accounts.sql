-- 建立帳號、IG 驗證碼、handle 鎖定、欄位限制（計畫 2）

-- 1. 欄位限制：建立與更新都適用
alter table public.profiles
  add constraint profiles_display_name_len check (char_length(display_name) between 1 and 60);
alter table public.brand_profiles
  add constraint brand_profiles_brand_name_len check (char_length(brand_name) between 1 and 60),
  add constraint brand_profiles_industry_len check (industry is null or char_length(industry) between 1 and 30);
alter table public.creator_profiles
  add constraint creator_profiles_ig_username_format check (ig_username ~ '^[A-Za-z0-9_.]{1,30}$'),
  add constraint creator_profiles_region_len check (region is null or char_length(region) between 1 and 30),
  add constraint creator_profiles_categories_max check (cardinality(categories) <= 5);

-- 2. 去掉前後空白與看不見的字元：
--    ASCII 空白（含 \f、\v）、U+00A0、U+1680、U+2000-U+200D（含零寬空白）、
--    U+2028、U+2029、U+202F、U+205F、U+2060、U+3000、U+FEFF
create function public.clean_text(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(p, E' \t\r\n\f\u000b\u00a0\u1680'
    || E'\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u200c\u200d'
    || E'\u2028\u2029\u202f\u205f\u2060\u3000\ufeff');
$$;
revoke execute on function public.clean_text(text) from public, anon, authenticated;

-- 3. 驗證碼：32 個不易混淆的字元（不含 0、O、1、I），256 是 32 的倍數所以分布均勻
create function public.gen_verification_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;
revoke execute on function public.gen_verification_code() from public, anon, authenticated;

create table public.creator_verifications (
  user_id uuid primary key references public.creator_profiles (user_id) on delete cascade,
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table public.creator_verifications enable row level security;
create policy creator_verifications_select on public.creator_verifications
  for select to authenticated
  using (creator_verifications.user_id = auth.uid() or public.is_admin());
revoke all on public.creator_verifications from anon, authenticated;
grant select on public.creator_verifications to authenticated;

-- 4. 建立帳號只能經由函式
drop policy profiles_insert_self on public.profiles;
drop policy brand_profiles_insert_self on public.brand_profiles;
drop policy creator_profiles_insert_self on public.creator_profiles;
revoke insert on public.profiles, public.brand_profiles, public.creator_profiles from anon, authenticated;

-- 5. Logo 改存 Storage 路徑（<user_id>/<檔名>），顯示用的網址由 App 組出來
alter table public.brand_profiles rename column logo_url to logo_path;
alter table public.brand_profiles
  add constraint brand_profiles_logo_path_check check (
    logo_path is null
    or (
      logo_path ~ ('^' || user_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
      and logo_path !~ '\.\.'
    )
  );

-- 5b. 修改資料只能經由 definer 函式：收回直接 UPDATE
drop policy profiles_update_self on public.profiles;
drop policy brand_profiles_update_self on public.brand_profiles;
drop policy creator_profiles_update_self on public.creator_profiles;
revoke update on public.profiles, public.brand_profiles, public.creator_profiles
  from anon, authenticated;

-- 6. handle：審核通過後對所有人鎖定（含 service_role 與 definer 函式）
--    唯一例外：Studio 管理者在同一個 transaction 先執行
--    set local kollink.allow_handle_change = 'on';
--    且 current_user 是 postgres 或 supabase_admin
create function public.creator_profiles_lock_handle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.handle is distinct from old.handle and old.status <> 'pending' then
    if coalesce(current_setting('kollink.allow_handle_change', true), '') = 'on'
       and current_user in ('postgres', 'supabase_admin') then
      return new;
    end if;
    raise exception 'handle locked after approval' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger creator_profiles_lock_handle
  before update on public.creator_profiles
  for each row execute function public.creator_profiles_lock_handle();

-- 內部共用檢查（只給 definer 函式呼叫）
create function public.check_logo_path(p_uid uuid, p_path text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(public.clean_text(p_path), '');
begin
  if v is not null and (
    v !~ ('^' || p_uid::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$') or v ~ '\.\.'
  ) then
    raise exception 'invalid logo_path' using errcode = '22023';
  end if;
  return v;
end;
$$;
revoke execute on function public.check_logo_path(uuid, text) from public, anon, authenticated;

create function public.check_categories(p text[]) returns text[]
language plpgsql immutable set search_path = '' as $$
declare
  v_cats text[];
begin
  select array_agg(public.clean_text(c) order by ord)
    into v_cats
    from unnest(p) with ordinality as t(c, ord);
  if v_cats is null
     or cardinality(v_cats) not between 1 and 5
     or exists (select 1 from unnest(v_cats) as c where c is null or char_length(c) not between 1 and 20)
     or (select count(distinct c) from unnest(v_cats) as c) <> cardinality(v_cats) then
    raise exception 'invalid categories' using errcode = '22023';
  end if;
  return v_cats;
end;
$$;
revoke execute on function public.check_categories(text[]) from public, anon, authenticated;

-- 7. 建立品牌帳號
create function public.create_brand_account(
  p_brand_name text,
  p_industry text,
  p_logo_path text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.clean_text(p_brand_name);
  v_industry text := public.clean_text(p_industry);
  v_logo text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'account already exists' using errcode = '23505';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 60 then
    raise exception 'invalid brand_name' using errcode = '22023';
  end if;
  if v_industry is null or char_length(v_industry) not between 1 and 30 then
    raise exception 'invalid industry' using errcode = '22023';
  end if;
  v_logo := public.check_logo_path(v_uid, p_logo_path);

  begin
    insert into public.profiles (id, role, display_name) values (v_uid, 'brand', v_name);
    insert into public.brand_profiles (user_id, brand_name, industry, logo_path)
    values (v_uid, v_name, v_industry, v_logo);
  exception when unique_violation then
    raise exception 'account already exists' using errcode = '23505';
  end;
end;
$$;
revoke execute on function public.create_brand_account(text, text, text) from public, anon;
grant execute on function public.create_brand_account(text, text, text) to authenticated;

-- 7b. 修改品牌資料（同一個 transaction 同步 profiles.display_name）
create function public.update_brand_account(
  p_brand_name text,
  p_industry text,
  p_logo_path text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.clean_text(p_brand_name);
  v_industry text := public.clean_text(p_industry);
  v_logo text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.brand_profiles where user_id = v_uid) then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 60 then
    raise exception 'invalid brand_name' using errcode = '22023';
  end if;
  if v_industry is null or char_length(v_industry) not between 1 and 30 then
    raise exception 'invalid industry' using errcode = '22023';
  end if;
  v_logo := public.check_logo_path(v_uid, p_logo_path);

  update public.brand_profiles
    set brand_name = v_name, industry = v_industry, logo_path = v_logo
    where user_id = v_uid;
  update public.profiles set display_name = v_name where id = v_uid;
end;
$$;
revoke execute on function public.update_brand_account(text, text, text) from public, anon;
grant execute on function public.update_brand_account(text, text, text) to authenticated;

-- 8. 建立創作者帳號，回傳 IG 驗證碼
create function public.create_creator_account(
  p_display_name text,
  p_handle text,
  p_ig_username text,
  p_follower_count integer,
  p_region text,
  p_categories text[]
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.clean_text(p_display_name);
  v_handle text := public.clean_text(p_handle);
  v_ig text := public.clean_text(p_ig_username);
  v_region text := public.clean_text(p_region);
  v_cats text[];
  v_code text;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'account already exists' using errcode = '23505';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid display_name' using errcode = '22023';
  end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'invalid handle' using errcode = '22023';
  end if;
  if v_ig is null or v_ig !~ '^[A-Za-z0-9_.]{1,30}$' then
    raise exception 'invalid ig_username' using errcode = '22023';
  end if;
  if p_follower_count is null or p_follower_count < 0 then
    raise exception 'invalid follower_count' using errcode = '22023';
  end if;
  if v_region is null or char_length(v_region) not between 1 and 30 then
    raise exception 'invalid region' using errcode = '22023';
  end if;

  v_cats := public.check_categories(p_categories);

  begin
    insert into public.profiles (id, role, display_name) values (v_uid, 'creator', v_name);
    insert into public.creator_profiles
      (user_id, handle, ig_username, follower_count, region, categories, status)
    values (v_uid, v_handle, v_ig, p_follower_count, v_region, v_cats, 'pending');
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'creator_profiles_handle_key' then
      raise exception 'handle taken' using errcode = '23505';
    end if;
    raise exception 'account already exists' using errcode = '23505';
  end;

  v_code := public.gen_verification_code();
  insert into public.creator_verifications (user_id, code) values (v_uid, v_code);
  return v_code;
end;
$$;
revoke execute on function public.create_creator_account(text, text, text, integer, text, text[]) from public, anon;
grant execute on function public.create_creator_account(text, text, text, integer, text, text[]) to authenticated;

-- 8b. 修改創作者資料（handle 審核前可改；同步 profiles.display_name）
create function public.update_creator_account(
  p_display_name text,
  p_handle text,
  p_ig_username text,
  p_follower_count integer,
  p_region text,
  p_categories text[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.clean_text(p_display_name);
  v_handle text := public.clean_text(p_handle);
  v_ig text := public.clean_text(p_ig_username);
  v_region text := public.clean_text(p_region);
  v_cats text[];
  v_old_handle text;
  v_status text;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select handle, status into v_old_handle, v_status
    from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid display_name' using errcode = '22023';
  end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'invalid handle' using errcode = '22023';
  end if;
  if v_ig is null or v_ig !~ '^[A-Za-z0-9_.]{1,30}$' then
    raise exception 'invalid ig_username' using errcode = '22023';
  end if;
  if p_follower_count is null or p_follower_count < 0 then
    raise exception 'invalid follower_count' using errcode = '22023';
  end if;
  if v_region is null or char_length(v_region) not between 1 and 30 then
    raise exception 'invalid region' using errcode = '22023';
  end if;
  v_cats := public.check_categories(p_categories);
  if v_status <> 'pending' and v_handle <> v_old_handle then
    raise exception 'handle locked after approval' using errcode = '42501';
  end if;

  begin
    update public.creator_profiles
      set handle = v_handle, ig_username = v_ig, follower_count = p_follower_count,
          region = v_region, categories = v_cats
      where user_id = v_uid;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'creator_profiles_handle_key' then
      raise exception 'handle taken' using errcode = '23505';
    end if;
    raise;
  end;
  update public.profiles set display_name = v_name where id = v_uid;
end;
$$;
revoke execute on function public.update_creator_account(text, text, text, integer, text, text[]) from public, anon;
grant execute on function public.update_creator_account(text, text, text, integer, text, text[]) to authenticated;
