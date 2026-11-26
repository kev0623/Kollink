-- 站內訊息（計畫 7）審查修正：速率限制加 advisory lock、聯絡方式偵測強化（去除不可見字元、電話分隔符加 _ 與 /）。
-- 與 src/lib/messages/contact.ts 同步；測試案例見 20_messaging_review_fixes.test.sql 與 contact.test.ts。
-- create or replace 不會改變既有的 revoke／grant，這裡仍重述一次。

create or replace function public.has_contact_info(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  -- NFKC、轉小寫後，先去掉不可見字元（U+00AD、U+034F、U+200B–U+200F、U+2060–U+2064、U+FEFF）再比對
  v text := regexp_replace(lower(normalize(coalesce(p, ''), nfkc)),
                           '[\u00ad\u034f\u200b-\u200f\u2060-\u2064\ufeff]', '', 'g');
  d text;
begin
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

create or replace function public.start_conversation(p_creator_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.my_role() is distinct from 'brand'
     or not exists (select 1 from public.brand_profiles bp where bp.user_id = v_uid) then
    raise exception 'not a brand' using errcode = '42501';
  end if;
  select cv.id into v_id from public.conversations cv
   where cv.brand_id = v_uid and cv.creator_id = p_creator_id;
  if v_id is not null then
    return v_id;
  end if;
  if not exists (select 1 from public.creator_profiles cp
                  where cp.user_id = p_creator_id and cp.status = 'approved') then
    raise exception 'creator not found' using errcode = 'P0002';
  end if;
  -- 同一個品牌的並發請求排隊，避免同時通過計數檢查（交易結束自動釋放）
  perform pg_advisory_xact_lock(hashtextextended('kollink.conv:' || v_uid::text, 0));
  if (select count(*) from public.conversations cv
       where cv.brand_id = v_uid and cv.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many conversations' using errcode = '54000';
  end if;
  return public.ensure_conversation(v_uid, p_creator_id);
end;
$$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  flagged_contact boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_body text := nullif(public.clean_text(regexp_replace(p_body, E'\r\n?', E'\n', 'g')), '');
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select cp.status into v_status
    from public.conversations cv
    join public.creator_profiles cp on cp.user_id = cv.creator_id
   where cv.id = p_conversation_id and (cv.brand_id = v_uid or cv.creator_id = v_uid);
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'conversation closed' using errcode = '55000';
  end if;
  if v_body is null or public.has_bidi(v_body) or char_length(v_body) > 2000 then
    raise exception 'invalid body' using errcode = '22023';
  end if;
  -- 同一個人的並發請求排隊，避免同時通過計數檢查（交易結束自動釋放）
  perform pg_advisory_xact_lock(hashtextextended('kollink.msg:' || v_uid::text, 0));
  if (select count(*) from public.messages m
       where m.sender_id = v_uid and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  return query
  insert into public.messages as m (conversation_id, sender_id, body)
  values (p_conversation_id, v_uid, v_body)
  returning m.id, m.conversation_id, m.sender_id, m.body, m.flagged_contact, m.created_at;
end;
$$;

revoke execute on function public.has_contact_info(text) from public, anon, authenticated, service_role;
revoke execute on function public.start_conversation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.start_conversation(uuid) to authenticated;
revoke execute on function public.send_message(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.send_message(uuid, text) to authenticated;
