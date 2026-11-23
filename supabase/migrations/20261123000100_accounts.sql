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

-- 2. 去掉前後空白（含全形空白 U+3000）
create function public.clean_text(p text) returns text
language sql immutable set search_path = '' as $$
  select btrim(p, E' \t\r\n' || chr(12288));
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

-- 5. Logo 網址必須指向本專案 brand-logos bucket 裡自己的資料夾
create function public.brand_profiles_check_logo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.logo_url is not null and new.logo_url !~ (
    '^https?://[^/]+/storage/v1/object/public/brand-logos/' || new.user_id::text || '/[A-Za-z0-9._-]{1,100}$'
  ) then
    raise exception 'invalid logo_url' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger brand_profiles_check_logo
  before insert or update on public.brand_profiles
  for each row execute function public.brand_profiles_check_logo();

-- 6. handle：審核前可改，通過後鎖定（只限制 API 使用者；資料庫擁有者在 Studio 仍可修改）
grant update (handle) on public.creator_profiles to authenticated;
create function public.creator_profiles_lock_handle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.handle is distinct from old.handle
     and old.status <> 'pending'
     and current_user in ('authenticated', 'anon') then
    raise exception 'handle locked after approval' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger creator_profiles_lock_handle
  before update on public.creator_profiles
  for each row execute function public.creator_profiles_lock_handle();

-- 7. 建立品牌帳號
create function public.create_brand_account(
  p_brand_name text,
  p_industry text,
  p_logo_url text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.clean_text(p_brand_name);
  v_industry text := public.clean_text(p_industry);
  v_logo text := nullif(public.clean_text(p_logo_url), '');
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

  insert into public.profiles (id, role, display_name) values (v_uid, 'brand', v_name);
  -- logo_url 由 brand_profiles_check_logo trigger 檢查
  insert into public.brand_profiles (user_id, brand_name, industry, logo_url)
  values (v_uid, v_name, v_industry, v_logo);
end;
$$;
revoke execute on function public.create_brand_account(text, text, text) from public, anon;
grant execute on function public.create_brand_account(text, text, text) to authenticated;

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

  select array_agg(public.clean_text(c) order by ord)
    into v_cats
    from unnest(p_categories) with ordinality as t(c, ord);
  if v_cats is null
     or cardinality(v_cats) not between 1 and 5
     or exists (select 1 from unnest(v_cats) as c where c is null or char_length(c) not between 1 and 20)
     or (select count(distinct c) from unnest(v_cats) as c) <> cardinality(v_cats) then
    raise exception 'invalid categories' using errcode = '22023';
  end if;

  insert into public.profiles (id, role, display_name) values (v_uid, 'creator', v_name);
  begin
    insert into public.creator_profiles
      (user_id, handle, ig_username, follower_count, region, categories, status)
    values (v_uid, v_handle, v_ig, p_follower_count, v_region, v_cats, 'pending');
  exception when unique_violation then
    raise exception 'handle taken' using errcode = '23505';
  end;

  v_code := public.gen_verification_code();
  insert into public.creator_verifications (user_id, code) values (v_uid, v_code);
  return v_code;
end;
$$;
revoke execute on function public.create_creator_account(text, text, text, integer, text, text[]) from public, anon;
grant execute on function public.create_creator_account(text, text, text, integer, text, text[]) to authenticated;
