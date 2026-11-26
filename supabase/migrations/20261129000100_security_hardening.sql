-- 資安修正（資料庫）：全系統體檢 audit-db.md 的 M1–M4、L1–L8（brief：.superpowers/sdd/sec-fix-brief.md Part A 1–12）。
-- 管理員兩步驟驗證（Part A 13）在 20261129000200_admin_mfa.sql。
-- 每個 create or replace 都完整複製該函式最新的定義（註解標出來源檔），只改標「資安修正」的地方。

-- ===================================================================================
-- 11. (L7) 文字 helper 先擋超長輸入，再跑 regex。上限 200,000 bytes 遠大於任何欄位的字數上限（最長是訊息 32,000 bytes）。
--     clean_text／has_bidi 由 sql 改成 plpgsql（sql 函式不能 raise）；immutable、回傳型別、null 進 null 出都不變。
-- ===================================================================================
-- 來源：20261123000100_accounts.sql
create or replace function public.clean_text(p text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  -- \u8cc7\u5b89\u4fee\u6b63\uff1a\u8d85\u9577\u8f38\u5165\u76f4\u63a5\u62d2\u7d55\uff0c\u4e0d\u8dd1 regex
  if octet_length(p) > 200000 then
    raise exception 'text too long' using errcode = '22023';
  end if;
  return btrim(
    regexp_replace(p, E'[\u200b\u2060\ufeff]', '', 'g'),
    E' \t\r\n\f\u000b\u0085\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u180e'
    || E'\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u200c\u200d\u200e\u200f'
    || E'\u2028\u2029\u202f\u205f\u2060\u2061\u2062\u2063\u2064\u2800\u3000\u3164\ufe0f\ufeff\uffa0');
end;
$$;
revoke execute on function public.clean_text(text) from public, anon, authenticated;

create or replace function public.has_bidi(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  -- \u8cc7\u5b89\u4fee\u6b63\uff1a\u8d85\u9577\u8f38\u5165\u76f4\u63a5\u62d2\u7d55\uff08\u8207 clean_text \u76f8\u540c\uff09
  if octet_length(p) > 200000 then
    raise exception 'text too long' using errcode = '22023';
  end if;
  return coalesce(p ~ E'[\u202a-\u202e\u2066-\u2069]', false);
end;
$$;
revoke execute on function public.has_bidi(text) from public, anon, authenticated;

-- 來源：20261126000300_messaging_review_fixes.sql
create or replace function public.has_contact_info(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v text;
  d text;
begin
  -- 資安修正：超長輸入直接拒絕（與 clean_text 相同）；原本在 declare 初始化的 v 移到檢查之後
  if octet_length(p) > 200000 then
    raise exception 'text too long' using errcode = '22023';
  end if;
  -- NFKC、轉小寫後，先去掉不可見字元（U+00AD、U+034F、U+200B–U+200F、U+2060–U+2064、U+FEFF）再比對
  v := regexp_replace(lower(normalize(coalesce(p, ''), nfkc)),
                      '[\u00ad\u034f\u200b-\u200f\u2060-\u2064\ufeff]', '', 'g');
  -- Email
  if v ~ '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}' then
    return true;
  end if;
  -- 外部連結：https://、www.、常見網域結尾（line.me、bit.ly 也在這裡）
  if v ~ '(https?://|www\.)'
     or v ~ '[a-z0-9-]\.(com|net|org|tw|me|io|co|cc|ly|gl|app|link|page|site)([^a-z0-9]|$)' then
    return true;
  end if;
  -- LINE：「line id」「line:」「line@」、「加我賴」「加個line」、「賴:」
  if v ~ '(^|[^a-z])line[ \t]*(id|[:@])'
     or v ~ '加[^\n]{0,2}(賴|line)'
     or v ~ '賴[ \t]*(id|[:@])' then
    return true;
  end if;
  -- 電話：手機 09xxxxxxxx、+886 9xxxxxxxx；市話 0[2-8] 加 7–8 碼
  d := regexp_replace(v, '[ \t().\-_/]', '', 'g');
  if d ~ '(^|[^0-9])(\+?886|0)9[0-9]{8}([^0-9]|$)'
     or d ~ '(^|[^0-9])0[2-8][0-9]{7,8}([^0-9]|$)' then
    return true;
  end if;
  return false;
end;
$$;


-- ===================================================================================
-- 1. (M1) 創作者在 awaiting_payment 可以 cancel（付款前退出）；3a. (M3) 未核准的創作者不能接受邀約
-- ===================================================================================
-- 來源：20261128000200_admin_money.sql
create or replace function public.transition_collaboration(
  p_collab_id uuid,
  p_action text,
  p_note text default null,
  p_published_url text default null
) returns public.collab_status
language plpgsql security definer set search_path = '' as $$
declare
  c public.collaborations%rowtype;
  v_uid uuid := auth.uid();
  v_actor text;
  v_to public.collab_status;
  -- 與 src/lib/validation/collab.ts 的 NOTE_MAX（1000）、POST_URL_MAX（500）、hasBadChar 一致
  v_note text := nullif(public.clean_text(p_note), '');
  v_url text := nullif(public.clean_text(p_published_url), '');
begin
  if v_note is not null and (public.has_bidi(v_note) or char_length(v_note) > 1000) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  if v_url is not null and (public.has_bidi(v_url) or char_length(v_url) > 500) then
    raise exception 'invalid published_url' using errcode = '22023';
  end if;

  select * into c from public.collaborations where id = p_collab_id for update;
  if not found then
    raise exception 'collaboration % not found', p_collab_id using errcode = 'P0002';
  end if;

  -- 身分優先順序：system > brand > creator > admin（參與者永遠以參與者身分行動）
  if coalesce(auth.role(), '') = 'service_role'
     and coalesce(current_setting('role', true), '') = 'service_role' then
    v_actor := 'system';
  elsif v_uid = c.brand_id then
    v_actor := 'brand';
  elsif v_uid = c.creator_id then
    v_actor := 'creator';
  elsif public.is_admin() then
    v_actor := 'admin';
  else
    raise exception 'not a participant of collaboration %', p_collab_id using errcode = '42501';
  end if;

  -- 資安修正（M3）：停權（或其他非 approved）的創作者不能接受邀約；已在進行中的合作案不受影響
  if c.status = 'invited' and p_action = 'accept' and v_actor = 'creator'
     and not exists (select 1 from public.creator_profiles cp
                      where cp.user_id = c.creator_id and cp.status = 'approved') then
    raise exception 'creator not approved' using errcode = '55000';
  end if;

  v_to := case
    when c.status = 'invited' and p_action = 'accept' and v_actor = 'creator'
      then 'awaiting_payment'::public.collab_status
    when c.status = 'invited' and p_action = 'decline' and v_actor = 'creator'
      then 'declined'::public.collab_status
    when c.status in ('invited', 'awaiting_payment') and p_action = 'cancel' and v_actor = 'brand'
      then 'cancelled'::public.collab_status
    -- 資安修正（M1）：創作者付款前可以退出（品牌錄取報名時直接進 awaiting_payment，創作者沒有其他拒絕的機會）
    when c.status = 'awaiting_payment' and p_action = 'cancel' and v_actor = 'creator'
      then 'cancelled'::public.collab_status
    when c.status = 'awaiting_payment' and p_action = 'mark_paid' and v_actor in ('system', 'admin')
         and coalesce(current_setting('kollink.recording_payment', true), '') = 'on'
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_submission' and p_action = 'submit' and v_actor = 'creator'
         and coalesce(current_setting('kollink.submitting_deliverables', true), '') = 'on'
      then 'in_review'::public.collab_status
    when c.status = 'in_review' and p_action = 'approve' and v_actor = 'brand'
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'auto_approve' and v_actor = 'system'
         and c.review_due_at <= now()
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'request_changes' and v_actor = 'brand'
         and v_note is not null
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_publish' and p_action = 'publish' and v_actor = 'creator'
         and v_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}/\S+$'
      then 'awaiting_payout'::public.collab_status
    when c.status = 'awaiting_payout' and p_action = 'payout' and v_actor in ('admin', 'system')
         and coalesce(current_setting('kollink.paying_out', true), '') = 'on'
      then 'completed'::public.collab_status
    when c.status in ('invited', 'awaiting_payment', 'awaiting_submission', 'in_review',
                      'awaiting_publish', 'awaiting_payout')
         and p_action = 'admin_cancel' and v_actor in ('admin', 'system')
         and coalesce(current_setting('kollink.admin_cancelling', true), '') = 'on'
         and v_note is not null
      then 'cancelled'::public.collab_status
    else null
  end;

  if v_to is null then
    raise exception 'invalid transition: % from % by %', p_action, c.status, v_actor
      using errcode = '22023';
  end if;

  perform set_config('kollink.in_transition', 'on', true);
  update public.collaborations
  set status = v_to,
      updated_at = now(),
      review_due_at = case when v_to = 'in_review' then now() + interval '3 days' else review_due_at end,
      published_url = case when v_to = 'awaiting_payout' then v_url else published_url end
  where id = c.id;
  perform set_config('kollink.in_transition', 'off', true);

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values (c.id, case when v_actor = 'system' then null else v_uid end, v_actor, p_action, c.status, v_to, v_note);

  return v_to;
end;
$$;
revoke execute on function public.transition_collaboration(uuid, text, text, text) from public, anon;
grant execute on function public.transition_collaboration(uuid, text, text, text) to authenticated, service_role;

-- ===================================================================================
-- 2. (M2) invite_creator：每個品牌 24 小時內最多 30 次邀請（含已取消／已婉拒），advisory lock 序列化
-- ===================================================================================
-- 來源：20261125000100_collab_create.sql
create or replace function public.invite_creator(
  p_creator_id uuid, p_title text, p_deliverables text, p_amount_twd integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  v_deliverables text;
  v_conversation uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.my_role() is distinct from 'brand'
     or not exists (select 1 from public.brand_profiles bp where bp.user_id = v_uid) then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  if not exists (select 1 from public.creator_profiles cp
                  where cp.user_id = p_creator_id and cp.status = 'approved') then
    raise exception 'creator not found' using errcode = 'P0002';
  end if;
  select o.title, o.deliverables into v_title, v_deliverables
    from public.check_collab_offer(p_title, p_deliverables, p_amount_twd) o;

  -- 資安修正（M2）：每個品牌 24 小時內最多 30 次邀請（邀請 = 沒有 brief_id 的合作案，含已取消／已婉拒）。
  -- 同一個品牌的邀請以 advisory lock 序列化，計數不會被並發繞過。
  perform pg_advisory_xact_lock(hashtextextended('kollink.invite:' || v_uid::text, 0));
  if (select count(*) from public.collaborations c
       where c.brand_id = v_uid and c.brief_id is null
         and c.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many invites' using errcode = '54000';
  end if;

  v_conversation := public.ensure_conversation(v_uid, p_creator_id);
  if exists (select 1 from public.collaborations c
              where c.brand_id = v_uid and c.creator_id = p_creator_id and c.status = 'invited') then
    raise exception 'already invited' using errcode = '23505';
  end if;
  insert into public.collaborations
    (brand_id, creator_id, conversation_id, title, deliverables, amount_twd, status)
  values
    (v_uid, p_creator_id, v_conversation, v_title, v_deliverables, p_amount_twd, 'invited')
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.invite_creator(uuid, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.invite_creator(uuid, text, text, integer) to authenticated;

-- ===================================================================================
-- 3b. (M3) 錄取報名時創作者必須是 approved
-- ===================================================================================
-- 來源：20261125000100_collab_create.sql
create or replace function public.accept_application_with_collab(
  p_application_id uuid, p_amount_twd integer, p_deliverables text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_brief_id uuid;
  v_brief_title text;
  v_creator_id uuid;
  v_app_status text;
  v_deliverables text;
  v_conversation uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select a.brief_id, b.title, a.creator_id, a.status
    into v_brief_id, v_brief_title, v_creator_id, v_app_status
    from public.brief_applications a
    join public.briefs b on b.id = a.brief_id
   where a.id = p_application_id and b.brand_id = v_uid
   for update of a;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  if v_app_status <> 'applied' then
    raise exception 'application not pending' using errcode = '55000';
  end if;
  -- 資安修正（M3）：報名後被停權（或其他非 approved）的創作者不能被錄取
  if not exists (select 1 from public.creator_profiles cp
                  where cp.user_id = v_creator_id and cp.status = 'approved') then
    raise exception 'creator not approved' using errcode = '55000';
  end if;
  select o.deliverables into v_deliverables
    from public.check_collab_offer(coalesce(v_brief_title, ''), p_deliverables, p_amount_twd) o;

  update public.brief_applications a set status = 'accepted' where a.id = p_application_id;
  v_conversation := public.ensure_conversation(v_uid, v_creator_id);
  begin
    insert into public.collaborations
      (brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd, status)
    values
      (v_uid, v_creator_id, v_brief_id, v_conversation, v_brief_title, v_deliverables, p_amount_twd, 'awaiting_payment')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'collaboration exists' using errcode = '23505';
  end;
  return v_id;
end;
$$;
revoke execute on function public.accept_application_with_collab(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.accept_application_with_collab(uuid, integer, text) to authenticated;

-- ===================================================================================
-- 3c. (M3) 建立付款單時創作者必須是 approved（3d：admin_record_offline_payment 不擋，由管理員判斷）
-- ===================================================================================
-- 來源：20261127000200_payment_review_fixes.sql
create or replace function public.create_payment_order(p_collab_id uuid, p_method text)
returns table (merchant_trade_no text, amount_twd integer, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_no text;
  v_recent integer;
  v_attempt integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_method is null or p_method not in ('credit', 'atm') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found or (c.brand_id <> v_uid and c.creator_id <> v_uid) then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if c.brand_id <> v_uid then
    raise exception 'not collaboration brand' using errcode = '42501';
  end if;
  if c.status <> 'awaiting_payment' then
    raise exception 'collaboration not awaiting payment' using errcode = '55000';
  end if;
  -- 資安修正（M3）：創作者不是 approved（例如已停權）時不能付款
  if not exists (select 1 from public.creator_profiles cp
                  where cp.user_id = c.creator_id and cp.status = 'approved') then
    raise exception 'creator not approved' using errcode = '55000';
  end if;
  if c.amount_twd > 200000 then
    raise exception 'amount exceeds online payment limit' using errcode = '22023';
  end if;
  select count(*) into v_recent from public.payments p
   where p.collaboration_id = c.id and p.created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'too many payment orders' using errcode = '54000';
  end if;

  -- KL + 台灣日期 YYMMDD + 12 位大寫十六進位 = 20 字（綠界 MerchantTradeNo 上限 20、英數字；測試商店是共用的，要夠亂）
  -- 單號碰撞（unique_violation）時重新產生，最多 3 次
  for v_attempt in 1..3 loop
    v_no := 'KL' || to_char(now() at time zone 'Asia/Taipei', 'YYMMDD')
            || upper(left(replace(gen_random_uuid()::text, '-', ''), 12));
    begin
      insert into public.payments
        (collaboration_id, provider, merchant_trade_no, amount_twd, payment_method, created_by)
      values (c.id, 'ecpay', v_no, c.amount_twd, p_method, v_uid);
      exit;
    exception when unique_violation then
      if v_attempt = 3 then raise; end if;
    end;
  end loop;

  return query
  select p.merchant_trade_no, p.amount_twd, p.created_at
    from public.payments p where p.merchant_trade_no = v_no;
end;
$$;
revoke execute on function public.create_payment_order(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.create_payment_order(uuid, text) to authenticated;

-- ===================================================================================
-- 4. (M4) 粉絲數上限 100,000,000（函式與資料表 CHECK）；已核准的創作者改粉絲數／互動率寫 audit_logs
-- ===================================================================================
-- 來源：20261123000100_accounts.sql
create or replace function public.create_creator_account(
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
  if v_name is null or public.has_bidi(v_name) or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid display_name' using errcode = '22023';
  end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'invalid handle' using errcode = '22023';
  end if;
  if v_ig is null or v_ig !~ '^[A-Za-z0-9_.]{1,30}$' then
    raise exception 'invalid ig_username' using errcode = '22023';
  end if;
  -- 資安修正（M4）：上限 100,000,000（與 creator_profiles_follower_count_max 相同）
  if p_follower_count is null or p_follower_count < 0 or p_follower_count > 100000000 then
    raise exception 'invalid follower_count' using errcode = '22023';
  end if;
  if v_region is null or public.has_bidi(v_region) or char_length(v_region) not between 1 and 30 then
    raise exception 'invalid region' using errcode = '22023';
  end if;

  v_cats := public.check_categories(p_categories);

  begin
    insert into public.profiles (id, role, display_name) values (v_uid, 'creator', v_name);
    insert into public.creator_profiles
      (user_id, handle, ig_username, follower_count, region, categories, status)
    values (v_uid, v_handle, v_ig, p_follower_count, v_region, v_cats, 'pending');
  exception when unique_violation then
    -- 約束名稱 creator_profiles_handle_key 是 Postgres 對 handle unique 的預設命名
    -- （定義在 20261122000100_profiles.sql）；pgTAP 有測試斷言它存在，改名時要一起改
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

-- 來源：20261123000100_accounts.sql
create or replace function public.update_creator_account(
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
  v_old record;
  v_status text;
  v_code text;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select handle, ig_username, status, handle_locked_at into v_old
    from public.creator_profiles where user_id = v_uid for update;
  if not found then
    raise exception 'not a creator' using errcode = '42501';
  end if;
  if v_name is null or public.has_bidi(v_name) or char_length(v_name) not between 1 and 40 then
    raise exception 'invalid display_name' using errcode = '22023';
  end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'invalid handle' using errcode = '22023';
  end if;
  if v_ig is null or v_ig !~ '^[A-Za-z0-9_.]{1,30}$' then
    raise exception 'invalid ig_username' using errcode = '22023';
  end if;
  -- 資安修正（M4）：上限 100,000,000（與 creator_profiles_follower_count_max 相同）
  if p_follower_count is null or p_follower_count < 0 or p_follower_count > 100000000 then
    raise exception 'invalid follower_count' using errcode = '22023';
  end if;
  if v_region is null or public.has_bidi(v_region) or char_length(v_region) not between 1 and 30 then
    raise exception 'invalid region' using errcode = '22023';
  end if;
  v_cats := public.check_categories(p_categories);
  if v_old.handle_locked_at is not null and v_handle <> v_old.handle then
    raise exception 'handle locked after approval' using errcode = '42501';
  end if;

  v_status := v_old.status;
  if lower(v_ig) <> lower(v_old.ig_username) and v_old.status in ('approved', 'suspended') then
    if v_old.status = 'approved' then
      v_status := 'pending';
    end if;
    loop
      v_code := public.gen_verification_code();
      exit when not exists (
        select 1 from public.creator_verifications where user_id = v_uid and code = v_code
      );
    end loop;
    insert into public.creator_verifications (user_id, code) values (v_uid, v_code)
    on conflict (user_id) do update set code = excluded.code, created_at = now();
  end if;

  begin
    update public.creator_profiles
      set handle = v_handle, ig_username = v_ig, follower_count = p_follower_count,
          region = v_region, categories = v_cats, status = v_status
      where user_id = v_uid;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'creator_profiles_handle_key' then
      raise exception 'handle taken' using errcode = '23505';
    end if;
    raise;
  end;
  update public.profiles set display_name = v_name where id = v_uid;
  return v_code;
end;
$$;
revoke execute on function public.update_creator_account(text, text, text, integer, text, text[]) from public, anon;
grant execute on function public.update_creator_account(text, text, text, integer, text, text[]) to authenticated;

-- ===================================================================================
-- 6. (L2) 管理員兼參與者：resolve_payment_anomaly／mark_message_reviewed／set_creator_status
-- ===================================================================================
-- 處理人（管理員；service_role 的備用 SQL 是 null）
alter table public.payment_anomalies add column resolved_by uuid;

-- 來源：20261127000100_payment_orders.sql
create or replace function public.resolve_payment_anomaly(p_id bigint, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_note text := nullif(public.clean_text(p_note), '');
  a public.payment_anomalies%rowtype;
  -- 資安修正（L2）：記下身分與異常對應的合作案
  v_system boolean := coalesce(auth.role(), '') = 'service_role'
                      and coalesce(current_setting('role', true), '') = 'service_role';
  v_collab uuid;
begin
  if not (v_system or public.is_admin()) then
    raise exception 'not admin' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) > 500 or public.has_bidi(v_note) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select * into a from public.payment_anomalies where id = p_id for update;
  if not found then
    raise exception 'anomaly not found' using errcode = 'P0002';
  end if;
  if a.resolved_at is not null then
    raise exception 'anomaly already resolved' using errcode = '55000';
  end if;
  -- 資安修正（L2）：異常對應的合作案（異常本身的，或付款單所屬的）由參與者以外的管理員處理；對不到合作案的照常處理
  v_collab := coalesce(a.collaboration_id,
                       (select p.collaboration_id from public.payments p where p.id = a.payment_id));
  if not v_system and exists (select 1 from public.collaborations c
                               where c.id = v_collab and auth.uid() in (c.brand_id, c.creator_id)) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  update public.payment_anomalies
     set resolved_at = now(), resolved_note = v_note,
         resolved_by = case when v_system then null else auth.uid() end
   where id = a.id;
  -- 資安修正（L2）：寫 audit。collaboration_id 留 null（參與者讀不到；說明只在 resolved_note），合作案記在 subject_id
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, case when v_system then null else auth.uid() end, case when v_system then 'system' else 'admin' end,
          'payment_anomaly_resolved', v_collab, 'anomaly ' || a.id::text);
end;
$$;
revoke execute on function public.resolve_payment_anomaly(bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_payment_anomaly(bigint, text) to authenticated, service_role;

-- 來源：20261128000300_admin_review_fixes.sql
create or replace function public.set_creator_status(p_user_id uuid, p_action text, p_reason text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_reason text;
  v_old text;
  v_new text;
begin
  if p_action is null or p_action not in ('approve', 'reject', 'suspend', 'unsuspend') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if p_action in ('reject', 'suspend') then
    v_reason := public.admin_clean_note(p_reason, 'reason');
  elsif nullif(public.clean_text(p_reason), '') is not null then
    v_reason := public.admin_clean_note(p_reason, 'reason');
  end if;

  select cp.status into v_old from public.creator_profiles cp where cp.user_id = p_user_id for update;
  if not found then
    raise exception 'creator not found' using errcode = 'P0002';
  end if;
  if v_actor = 'admin' and p_user_id = auth.uid() then
    raise exception 'admin is subject' using errcode = '42501';
  end if;
  -- 資安修正（L2）：管理員與這位創作者有未結束的合作案（管理員是品牌）時不能改他的狀態
  if v_actor = 'admin' and exists (
       select 1 from public.collaborations c
        where c.creator_id = p_user_id and auth.uid() in (c.brand_id, c.creator_id)
          and c.status not in ('completed', 'declined', 'cancelled')) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  v_new := case
    when p_action = 'approve' and v_old in ('pending', 'rejected') then 'approved'
    when p_action = 'reject' and v_old = 'pending' then 'rejected'
    when p_action = 'suspend' and v_old = 'approved' then 'suspended'
    when p_action = 'unsuspend' and v_old = 'suspended' then 'approved'
  end;
  if v_new is null then
    raise exception 'creator status changed' using errcode = '55000';
  end if;

  update public.creator_profiles
     set status = v_new,
         review_note = case when v_new in ('rejected', 'suspended') then v_reason end
   where user_id = p_user_id;

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, case when v_actor = 'admin' then auth.uid() end, v_actor, 'creator_' || p_action, p_user_id, v_reason);
  return v_new;
end;
$$;
revoke execute on function public.set_creator_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_creator_status(uuid, text, text) to authenticated, service_role;

-- 來源：20261128000300_admin_review_fixes.sql
create or replace function public.mark_message_reviewed(p_message_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_sender uuid;
  v_flagged boolean;
  v_inserted uuid;
begin
  select m.sender_id, m.flagged_contact into v_sender, v_flagged from public.messages m where m.id = p_message_id;
  if not found then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  if v_actor = 'admin' and v_sender = auth.uid() then
    raise exception 'admin is subject' using errcode = '42501';
  end if;
  -- 資安修正（L2）：管理員是這則訊息所在對話的參與者時不能標記已審
  if v_actor = 'admin' and exists (
       select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
        where m.id = p_message_id and auth.uid() in (c.brand_id, c.creator_id)) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  if not v_flagged then
    raise exception 'message not flagged' using errcode = '22023';
  end if;
  insert into public.message_reviews (message_id, reviewed_by)
  values (p_message_id, case when v_actor = 'admin' then auth.uid() end)
  on conflict (message_id) do nothing
  returning message_id into v_inserted;
  if v_inserted is null then
    return false;
  end if;
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, case when v_actor = 'admin' then auth.uid() end, v_actor, 'message_reviewed', v_sender,
          'message ' || p_message_id::text);
  return true;
end;
$$;
revoke execute on function public.mark_message_reviewed(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_message_reviewed(uuid) to authenticated, service_role;

-- ===================================================================================
-- 5. (L1) Storage 上傳：副檔名白名單、物件數上限
-- ===================================================================================
-- 內部 helper：鎖住 <bucket>/<prefix> 再計數，回傳是否少於 p_max。不授權給 API 角色（只給下面的 definer 函式呼叫）。
-- 不用 storage.objects 的版本欄位（archived_at 等），舊版 storage schema 沒有。
create function public.storage_quota_ok(p_bucket text, p_prefix text, p_max integer) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('kollink.storage:' || p_bucket || ':' || p_prefix, 0));
  return (select count(*) from storage.objects o
           where o.bucket_id = p_bucket and o.name like p_prefix || '%') < p_max;
end;
$$;
revoke execute on function public.storage_quota_ok(text, text, integer) from public, anon, authenticated, service_role;

-- policy 用：目前使用者在公開 bucket 自己資料夾（<uid>/）的物件數是否還沒到上限。
-- insert policy 已要求第一層資料夾 = auth.uid()，所以使用者在該 bucket 的所有物件都在這個資料夾，換資料夾繞不過。
-- 上限：brand-logos 20、creator-media 60、brief-covers 100（Part B 的上傳錯誤文字要一致）。
create function public.storage_upload_quota_ok(p_bucket text) returns boolean
language sql volatile security definer set search_path = '' as $$
  select auth.uid() is not null
     and public.storage_quota_ok(p_bucket, auth.uid()::text || '/',
           case p_bucket when 'brand-logos' then 20 when 'creator-media' then 60 when 'brief-covers' then 100 else 0 end);
$$;
revoke execute on function public.storage_upload_quota_ok(text) from public, anon, authenticated, service_role;
grant execute on function public.storage_upload_quota_ok(text) to authenticated;

-- brand-logos：onboarding 的品牌表單（src/app/onboarding/BrandOnboardingForm.tsx → LogoField）在建立 profile 之前就上傳，
-- 所以沿用「不是創作者」（沒有 profile 也可以），只加副檔名與數量限制。
-- update policy（storage 的 move）也加副檔名，避免上傳後改名成其他副檔名。
drop policy brand_logos_insert_own on storage.objects;
create policy brand_logos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() is distinct from 'creator'
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
    and name ~* '\.(jpg|jpeg|png|webp)$'
    and public.storage_upload_quota_ok('brand-logos')
  );
drop policy brand_logos_update_own on storage.objects;
create policy brand_logos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() is distinct from 'creator'
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
    and name ~* '\.(jpg|jpeg|png|webp)$'
  );

drop policy creator_media_insert_own on storage.objects;
create policy creator_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
    and name ~ ('^' || auth.uid()::text || '/(avatar|portfolio)-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
    and name ~* '\.(jpg|jpeg|png|webp)$'
    and public.storage_upload_quota_ok('creator-media')
  );
drop policy creator_media_update_own on storage.objects;
create policy creator_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
    and name ~ ('^' || auth.uid()::text || '/(avatar|portfolio)-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
    and name ~* '\.(jpg|jpeg|png|webp)$'
  );

drop policy brief_covers_insert_own on storage.objects;
create policy brief_covers_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brief-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'brand'
    and name ~ ('^' || auth.uid()::text || '/cover-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
    and name ~* '\.(jpg|jpeg|png|webp)$'
    and public.storage_upload_quota_ok('brief-covers')
  );
drop policy brief_covers_update_own on storage.objects;
create policy brief_covers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'brief-covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'brief-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'brand'
    and name ~ ('^' || auth.uid()::text || '/cover-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
    and name ~* '\.(jpg|jpeg|png|webp)$'
  );

-- ===================================================================================
-- 8. (L4) 品牌只能讀已出現在交稿紀錄裡的檔案；5. (L1) deliverables 每個合作案資料夾最多 60 個物件
-- ===================================================================================
-- 來源：20261125000400_collab_review_fixes.sql
create or replace function public.can_read_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
       where c.id = case
               when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
               then split_part(p_name, '/', 1)::uuid
             end
         -- 資安修正（L4）：創作者讀自己合作案的檔案；品牌只讀已出現在交稿紀錄（file_paths）裡的檔案
         and (c.creator_id = auth.uid()
              or (c.brand_id = auth.uid()
                  and exists (select 1 from public.collaboration_submissions s
                               where s.collaboration_id = c.id and p_name = any (s.file_paths))))
    )
  );
$$;

-- 來源：20261125000400_collab_review_fixes.sql
-- 資安修正（L1）：多一個條件「這個合作案資料夾少於 60 個物件」（storage_quota_ok 會鎖住資料夾再計數），所以改成 volatile
create or replace function public.can_upload_deliverable(p_name text) returns boolean
language sql volatile security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.collaborations c
     where c.id = case
             when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
             then split_part(p_name, '/', 1)::uuid
           end
       and c.creator_id = auth.uid()
       and c.status = 'awaiting_submission'
       and public.deliverable_path_ok(c.id, c.creator_id, p_name)
       and public.storage_quota_ok('deliverables', c.id::text || '/', 60)
  );
$$;

-- ===================================================================================
-- 4. (M4) 資料表 CHECK 與粉絲數／互動率變更紀錄
-- ===================================================================================
-- 粉絲數上限（與 create_creator_account／update_creator_account 相同）。互動率 0–100 已由 creator_profiles_engagement_rate_check 保證。
-- 先 not valid 再嘗試 validate：既有資料若有超過上限的列，migration 不失敗（新寫入一律受限），只留 notice。
alter table public.creator_profiles
  add constraint creator_profiles_follower_count_max check (follower_count <= 100000000) not valid;
do $$
begin
  alter table public.creator_profiles validate constraint creator_profiles_follower_count_max;
exception when check_violation then
  raise notice 'creator_profiles_follower_count_max: existing rows exceed the limit; constraint left NOT VALID';
end;
$$;

-- 已核准（更新前是 approved）的創作者改粉絲數或互動率：寫一筆 audit_logs（不改狀態）。
-- collaboration_id 是 null（只有管理員讀得到）；subject_id = 創作者；note 只放「欄位 舊值→新值」。
create function public.creator_profiles_log_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_parts text[] := '{}';
  v_self boolean := auth.uid() is not distinct from new.user_id;
begin
  if old.status = 'approved' then
    if new.follower_count is distinct from old.follower_count then
      v_parts := v_parts || ('follower_count ' || old.follower_count::text || '→' || new.follower_count::text);
    end if;
    if new.engagement_rate is distinct from old.engagement_rate then
      v_parts := v_parts || ('engagement_rate ' || coalesce(old.engagement_rate::text, 'null')
                             || '→' || coalesce(new.engagement_rate::text, 'null'));
    end if;
    if cardinality(v_parts) > 0 then
      insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
      values (null, case when v_self then new.user_id end, case when v_self then 'creator' else 'system' end,
              'creator_stats_changed', new.user_id, array_to_string(v_parts, '; '));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.creator_profiles_log_stats() from public, anon, authenticated, service_role;
create trigger creator_profiles_log_stats
  after update of follower_count, engagement_rate on public.creator_profiles
  for each row execute function public.creator_profiles_log_stats();

-- ===================================================================================
-- 7. (L3) profiles／brand_profiles 的 select 收斂；audit_logs 不給 actor_id
-- ===================================================================================
-- authenticated 讀得到的使用者：自己、管理員看全部、已核准的創作者、與自己有對話／報名／合作關係的對象。
-- app 的直接讀取（src/）：current-user.ts／after-login.ts 讀自己的 profiles、brand_profiles；
-- briefs/view.ts 的 MY_APPLICATION_COLUMNS 讀「我報名的招募的品牌」brand_profiles(brand_name)（報名關係）。其他都走 definer RPC。
-- definer helper（不經過各表的 RLS）；只回傳布林，不多洩漏任何資料。
create function public.can_view_user(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.creator_profiles cp
                where cp.user_id = p_user_id and cp.status = 'approved')
    or exists (select 1 from public.conversations c
                where (c.brand_id = auth.uid() and c.creator_id = p_user_id)
                   or (c.creator_id = auth.uid() and c.brand_id = p_user_id))
    or exists (select 1 from public.collaborations c
                where (c.brand_id = auth.uid() and c.creator_id = p_user_id)
                   or (c.creator_id = auth.uid() and c.brand_id = p_user_id))
    or exists (select 1 from public.brief_applications a join public.briefs b on b.id = a.brief_id
                where (b.brand_id = auth.uid() and a.creator_id = p_user_id)
                   or (a.creator_id = auth.uid() and b.brand_id = p_user_id))
  );
$$;
revoke execute on function public.can_view_user(uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_view_user(uuid) to authenticated;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (public.can_view_user(id));
drop policy brand_profiles_select on public.brand_profiles;
create policy brand_profiles_select on public.brand_profiles
  for select to authenticated using (public.can_view_user(user_id));
-- creator_profiles_select 維持「approved／本人／管理員」（20261128000100_admin_core.sql），不加「有關係的對象」：
-- 那會讓合作過的品牌讀到停權創作者的 review_note（管理員寫的原因，只給本人看）。app 沒有這種直接讀取。

-- audit_logs：authenticated 改成欄位授權，不含 actor_id（app 用 list_collaboration_events 讀事件；src/ 沒有直接讀 actor_id）
revoke select on public.audit_logs from authenticated;
grant select (id, collaboration_id, actor_kind, action, from_status, to_status, note, created_at, subject_id)
  on public.audit_logs to authenticated;

-- ===================================================================================
-- 9. (L5) payments：ATM 虛擬帳號與綠界單號不再直接給 authenticated；品牌（與管理員）經由 get_my_payment_details 讀
-- ===================================================================================
revoke select (atm_bank_code, atm_v_account, atm_expire_date, provider_trade_no, merchant_trade_no)
  on public.payments from authenticated;

-- 一個合作案的付款單（由新到舊最多 20 筆，與 src/lib/collabs/load.ts 相同）。
-- 身分優先順序同 transition_collaboration：品牌 > 創作者 > 管理員。
-- 品牌與（非參與者的）管理員拿到 ATM 轉帳資訊；創作者拿到同樣的列，但 atm_* 一律是 null。
-- 不是參與者也不是管理員：P0002 collaboration not found（不透露是否存在）。
create function public.get_my_payment_details(p_collab_id uuid)
returns table (
  id uuid,
  status text,
  payment_method text,
  provider_env text,
  amount_twd integer,
  atm_bank_code text,
  atm_v_account text,
  atm_expire_date date,
  refund_required boolean,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_full boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into c from public.collaborations c0 where c0.id = p_collab_id;
  if not found then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if v_uid = c.brand_id then
    v_full := true;
  elsif v_uid = c.creator_id then
    v_full := false;
  elsif public.is_admin() then
    v_full := true;
  else
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  return query
  select p.id, p.status, p.payment_method, p.provider_env, p.amount_twd,
         case when v_full then p.atm_bank_code end,
         case when v_full then p.atm_v_account end,
         case when v_full then p.atm_expire_date end,
         p.refund_required, p.paid_at, p.created_at
    from public.payments p
   where p.collaboration_id = c.id
   order by p.created_at desc
   limit 20;
end;
$$;
revoke execute on function public.get_my_payment_details(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_my_payment_details(uuid) to authenticated;

-- ===================================================================================
-- 10. (L6) 預設權限與多餘的 anon 授權
-- ===================================================================================
-- 之後 public 新建的表／函式／sequence 不再自動授權給 anon、authenticated（每個 migration 都要自己 grant）。
-- 建立物件的角色：本機與雲端 migration 是 postgres；supabase_admin 的預設權限 postgres 不一定能改，權限不足就略過。
do $$
declare
  r text;
begin
  foreach r in array array['postgres', 'supabase_admin'] loop
    begin
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke all on functions from anon, authenticated', r);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated', r);
    exception when insufficient_privilege then
      raise notice 'skip default privileges for role %: insufficient privilege', r;
    end;
  end loop;
end;
$$;
-- 函式另外有「PUBLIC 可執行」的全域預設（不分 schema；per-schema 的 revoke 拿不掉），anon／authenticated 會經由 PUBLIC 執行。
-- 只對 postgres 建立的函式收回（migration 與 Dashboard SQL Editor 都是 postgres）；新函式一律自己 grant（既有規則）。
-- trigger 不檢查 EXECUTE，不受影響。
alter default privileges for role postgres revoke execute on functions from public;

-- anon 只留公開頁需要的：
--   creator_portfolio_items（訪客看公開頁，src/lib/creators/public-profile.ts loadPortfolio）
--   creator_profiles（creator_portfolio_items_select_anon 的子查詢要讀；review_note 不給）
--   其他公開資料走 get_public_creator（definer，anon 可執行）。
revoke select on public.audit_logs, public.profiles, public.brand_profiles, public.creator_rates from anon;
revoke select on public.creator_profiles from anon;
grant select (user_id, handle, ig_username, follower_count, engagement_rate, region, categories, style_tags,
              collab_types, bio, status, created_at, handle_locked_at, avatar_path, audience_age)
  on public.creator_profiles to anon;
-- identity 欄位的 sequence 只有 definer 函式（owner）會用
revoke all on all sequences in schema public from anon, authenticated;
-- trigger 函式不需要被 API 角色執行（trigger 觸發時不檢查 EXECUTE）
revoke execute on function public.audit_logs_block_mutation(), public.collaborations_guard_update(),
  public.creator_profiles_lock_handle(), public.log_collaboration_created() from public, anon, authenticated;

-- ===================================================================================
-- 12. (L8) 收藏只能收藏已核准的創作者：不存在、未核准一律同一個錯誤（RLS 42501，不再出現 FK 錯誤）
-- ===================================================================================
-- with check 在 FK（statement 結束時的 trigger）之前檢查，所以不存在的 uuid 也是 RLS 錯誤。
-- handle taken（create_creator_account）維持：註冊時必須告知 handle 已被使用，列入待辦。
drop policy creator_favorites_insert_own on public.creator_favorites;
create policy creator_favorites_insert_own on public.creator_favorites
  for insert to authenticated
  with check (
    brand_id = auth.uid() and public.my_role() = 'brand'
    and exists (select 1 from public.creator_profiles cp
                 where cp.user_id = creator_favorites.creator_id and cp.status = 'approved')
  );
