-- 站內訊息（計畫 7）之一：寫入路徑。訊息只能經由 send_message 寫入；聯絡方式由 BEFORE INSERT trigger 判斷；
-- 品牌主動開啟對話（start_conversation）；已讀（conversation_reads、mark_conversation_read）；Realtime publication。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. messages 收回所有直接寫入（計畫 1 開放了參與者直接 insert；20261124000100 還給了 anon SELECT）。
--    之後只有 send_message（definer）能寫入；任何 API 角色都不能 UPDATE／DELETE。
drop policy messages_insert_participant on public.messages;
revoke all on public.messages from anon, authenticated, service_role;
grant select on public.messages to authenticated, service_role;

-- is_conversation_participant：messages_select policy 以 authenticated 身分呼叫（Realtime 檢查訂閱者能不能讀這一列時也是），
-- 所以保留 authenticated、service_role，從 PUBLIC 與 anon 收回（followups「9. 管理後台」的其中一項）。
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated, service_role;

-- 2. 內文 1–2000 字（計畫 1 是 4000；與 src/lib/validation/message.ts 的 MESSAGE_BODY_MAX 一致）。
--    計畫 7 之前沒有任何畫面能寫入訊息，正式環境不會有超過 2000 字的舊資料。
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) between 1 and 2000);

-- 頻率限制（send_message）用：同一個人最近 1 分鐘送出幾則
create index messages_sender_created_idx on public.messages (sender_id, created_at);

-- 3. 聯絡方式偵測（電話、Email、LINE、外部連結）。規則與 src/lib/messages/contact.ts 的 contactKinds 完全相同，
--    兩邊的註解互相指向；改一邊就要改另一邊，並更新兩邊共用的測試案例（18_messaging_write.test.sql、contact.test.ts）。
--    先 NFKC 正規化（全形數字、全形英文、全形冒號都變半形）再轉小寫；電話另外去掉空白、Tab、括號、點、連字號後比對。
--    這些都是沒有反向參照的正規表示式，「有沒有符合」在 Postgres ARE 與 JS 的結果相同。
create function public.has_contact_info(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v text := lower(normalize(coalesce(p, ''), nfkc));
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
  d := regexp_replace(v, '[ \t().-]', '', 'g');
  if d ~ '(^|[^0-9])(\+?886|0)9[0-9]{8}([^0-9]|$)'
     or d ~ '(^|[^0-9])0[2-8][0-9]{7,8}([^0-9]|$)' then
    return true;
  end if;
  return false;
end;
$$;
revoke execute on function public.has_contact_info(text) from public, anon, authenticated, service_role;

-- 4. flagged_contact 一律由這個 trigger 算（followups「7. 站內訊息」：不能讓訊息改走 service_role，
--    那樣 sender_id 的預設值 auth.uid() 會是 null）。任何路徑寫入（包含擁有者在 SQL Editor）都會重新計算。
create function public.messages_flag_contact() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.flagged_contact := public.has_contact_info(new.body);
  return new;
end;
$$;
revoke execute on function public.messages_flag_contact() from public, anon, authenticated, service_role;
create trigger messages_flag_contact before insert on public.messages
  for each row execute function public.messages_flag_contact();

-- 5. 已讀：每位參與者在每個對話各一列，last_read_at = 讀到的最後一則訊息的 created_at。
--    只能經由 mark_conversation_read 寫入；本人可以讀自己的列。
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null,
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
create policy conversation_reads_select_own on public.conversation_reads
  for select to authenticated
  using (user_id = auth.uid());
revoke all on public.conversation_reads from anon, authenticated, service_role;
grant select on public.conversation_reads to authenticated, service_role;

-- 6. 品牌主動開啟對話（公開頁「傳訊息」）：只有品牌、只能找已審核的創作者；已有對話就直接回傳（不論創作者現在的狀態）。
--    創作者不能主動開啟對話（使用者決定 2026-11-26）。同一個品牌 24 小時內最多建立 30 個新對話（防灌訊息）。
create function public.start_conversation(p_creator_id uuid) returns uuid
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
  if (select count(*) from public.conversations cv
       where cv.brand_id = v_uid and cv.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many conversations' using errcode = '54000';
  end if;
  return public.ensure_conversation(v_uid, p_creator_id);
end;
$$;
revoke execute on function public.start_conversation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.start_conversation(uuid) to authenticated;

-- 7. 送出訊息：只有對話的品牌或創作者（管理員不行）。
--    內文先把 CRLF／CR 換成 LF 再 clean_text，不可有 bidi，1–2000 字（與 src/lib/validation/message.ts 一致）。
--    創作者不是 approved（停權）時對話暫停，雙方都不能送（55000 conversation closed）。
--    頻率限制：同一個人 1 分鐘內最多 20 則（54000 too many messages）。回傳新訊息（含 trigger 算好的 flagged_contact）。
create function public.send_message(p_conversation_id uuid, p_body text)
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
revoke execute on function public.send_message(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.send_message(uuid, text) to authenticated;

-- 8. 標記已讀：last_read_at 推進到這個對話目前最後一則訊息的時間（只會往後、不會倒退）。沒有訊息時不寫。
create function public.mark_conversation_read(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversations cv
                  where cv.id = p_conversation_id and (cv.brand_id = v_uid or cv.creator_id = v_uid)) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads as r (conversation_id, user_id, last_read_at)
  select p_conversation_id, v_uid, max(m.created_at)
    from public.messages m
   where m.conversation_id = p_conversation_id
  having max(m.created_at) is not null
  on conflict (conversation_id, user_id)
  do update set last_read_at = greatest(r.last_read_at, excluded.last_read_at);
end;
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- 9. Realtime：新訊息推送給訂閱者。Postgres Changes 會以訂閱者的身分檢查 messages_select（RLS），
--    所以參與者（與管理員）只收得到自己讀得到的訊息。
alter publication supabase_realtime add table public.messages;
