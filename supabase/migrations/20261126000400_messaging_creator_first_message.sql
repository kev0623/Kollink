-- 站內訊息（計畫 7）最終審查修正：創作者不能搶先發訊息（空對話、無合作案）；內容清理移到身分檢查之後並先擋過大輸入。

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
  v_body text;
  v_status text;
  v_creator uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select cp.status, cv.creator_id into v_status, v_creator
    from public.conversations cv
    join public.creator_profiles cp on cp.user_id = cv.creator_id
   where cv.id = p_conversation_id and (cv.brand_id = v_uid or cv.creator_id = v_uid);
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  -- 創作者不能搶先發訊息：品牌開啟、還沒有任何訊息也沒有合作案的空對話，對創作者等同不存在
  if v_creator = v_uid
     and not exists (select 1 from public.messages m where m.conversation_id = p_conversation_id)
     and not exists (select 1 from public.collaborations c where c.conversation_id = p_conversation_id) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if v_status <> 'approved' then
    raise exception 'conversation closed' using errcode = '55000';
  end if;
  -- 先擋過大的輸入再清理，避免 clean_text 對超大字串耗 CPU
  if p_body is null or octet_length(p_body) > 32000 then
    raise exception 'invalid body' using errcode = '22023';
  end if;
  v_body := nullif(public.clean_text(regexp_replace(p_body, E'\r\n?', E'\n', 'g')), '');
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

revoke execute on function public.send_message(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.send_message(uuid, text) to authenticated;
