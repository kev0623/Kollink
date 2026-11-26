-- 站內訊息（計畫 7）之二：讀取用的 definer 函式（對話列表、對話標題、訊息分頁、未讀數），
-- 以及 get_collaboration 多回傳 conversation_id（合作案詳情的「前往對話」）。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會）。

-- 1. 我的對話列表：只列自己是品牌或創作者的對話（管理員看全部是計畫 9 的後台）。
--    創作者看不到「品牌開了但還沒傳任何訊息、也沒有合作案」的空對話；品牌看得到自己開的空對話。
--    對方的名稱與頭像：品牌讀不到 pending／停權創作者的 profile，所以用 definer 帶出；用 left join，
--    profile 不見時退回「品牌」「創作者」而不是讓整個對話消失（followups 計畫 6「列表用 inner join」一項）。
--    未讀 = 對方送出、而且晚於我的 last_read_at 的訊息數。closed = 創作者不是 approved（對話暫停）。
--    排序：最後一則訊息時間（沒有訊息用對話建立時間）由新到舊。最多 200 筆。
create function public.list_my_conversations()
returns table (
  id uuid,
  my_side text,
  counterpart_name text,
  counterpart_image_path text,
  counterpart_handle text,
  last_body text,
  last_sender_is_me boolean,
  last_at timestamptz,
  unread_count integer,
  closed boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select cv.id,
         case when cv.brand_id = v_uid then 'brand' else 'creator' end,
         case when cv.brand_id = v_uid then coalesce(p.display_name, '創作者') else coalesce(bp.brand_name, '品牌') end,
         case when cv.brand_id = v_uid then cp.avatar_path else bp.logo_path end,
         case when cv.brand_id = v_uid then cp.handle else null end,
         left(lm.body, 100),
         lm.sender_id = v_uid,
         coalesce(lm.created_at, cv.created_at),
         (select count(*)::int from public.messages m
           where m.conversation_id = cv.id and m.sender_id <> v_uid
             and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
         coalesce(cp.status, '') <> 'approved'
    from public.conversations cv
    left join public.brand_profiles bp on bp.user_id = cv.brand_id
    left join public.creator_profiles cp on cp.user_id = cv.creator_id
    left join public.profiles p on p.id = cv.creator_id
    left join public.conversation_reads r on r.conversation_id = cv.id and r.user_id = v_uid
    left join lateral (
      select m.body, m.sender_id, m.created_at from public.messages m
       where m.conversation_id = cv.id
       order by m.created_at desc, m.id desc
       limit 1
    ) lm on true
   where (cv.brand_id = v_uid or cv.creator_id = v_uid)
     and (cv.brand_id = v_uid
          or lm.created_at is not null
          or exists (select 1 from public.collaborations c where c.conversation_id = cv.id))
   order by coalesce(lm.created_at, cv.created_at) desc, cv.id
   limit 200;
end;
$$;
revoke execute on function public.list_my_conversations() from public, anon, authenticated, service_role;
grant execute on function public.list_my_conversations() to authenticated;

-- 2. 一個對話的標題資料：我是哪一方（brand > creator > admin）、雙方的公開資料、是否暫停。
--    不是參與者也不是管理員：0 列（頁面顯示 404）。
create function public.get_conversation(p_id uuid)
returns table (
  id uuid,
  my_side text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  creator_id uuid,
  creator_name text,
  creator_handle text,
  creator_avatar_path text,
  closed boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select cv.id,
         case when cv.brand_id = v_uid then 'brand' when cv.creator_id = v_uid then 'creator' else 'admin' end,
         cv.brand_id, coalesce(bp.brand_name, '品牌'), bp.logo_path,
         cv.creator_id, coalesce(p.display_name, '創作者'), cp.handle, cp.avatar_path,
         coalesce(cp.status, '') <> 'approved'
    from public.conversations cv
    left join public.brand_profiles bp on bp.user_id = cv.brand_id
    left join public.creator_profiles cp on cp.user_id = cv.creator_id
    left join public.profiles p on p.id = cv.creator_id
   where cv.id = p_id
     and (cv.brand_id = v_uid or cv.creator_id = v_uid or public.is_admin());
end;
$$;
revoke execute on function public.get_conversation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_conversation(uuid) to authenticated;

-- 3. 訊息分頁：由新到舊，(created_at, id) 早於游標的 p_limit 則（1..100，預設 50）。
--    第一頁游標傳 null。只有參與者與管理員拿得到，其他人 0 列。
create function public.list_messages(
  p_conversation_id uuid,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  flagged_contact boolean,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversations cv
                  where cv.id = p_conversation_id
                    and (cv.brand_id = v_uid or cv.creator_id = v_uid or public.is_admin())) then
    return;
  end if;
  return query
  select m.id, m.sender_id, m.body, m.flagged_contact, m.created_at
    from public.messages m
   where m.conversation_id = p_conversation_id
     and (p_before_at is null
          or (m.created_at, m.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by m.created_at desc, m.id desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;
revoke execute on function public.list_messages(uuid, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_messages(uuid, timestamptz, uuid, integer) to authenticated;

-- 4. 導覽列的未讀徽章：有未讀訊息的對話數。沒有登入或不是參與者：0。
create function public.unread_conversation_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.conversations cv
    left join public.conversation_reads r on r.conversation_id = cv.id and r.user_id = auth.uid()
   where (cv.brand_id = auth.uid() or cv.creator_id = auth.uid())
     and exists (select 1 from public.messages m
                  where m.conversation_id = cv.id and m.sender_id <> auth.uid()
                    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz));
$$;
revoke execute on function public.unread_conversation_count() from public, anon, authenticated, service_role;
grant execute on function public.unread_conversation_count() to authenticated;

-- 5. get_collaboration 多回傳 conversation_id（合作案詳情的「前往對話」）。回傳欄位變了，要先 drop；
--    其餘邏輯與 20261125000300_collab_reads.sql 完全相同。
drop function public.get_collaboration(uuid);
create function public.get_collaboration(p_id uuid)
returns table (
  id uuid,
  title text,
  deliverables text,
  amount_twd integer,
  status text,
  review_due_at timestamptz,
  published_url text,
  created_at timestamptz,
  updated_at timestamptz,
  brief_id uuid,
  brief_title text,
  my_side text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  creator_id uuid,
  creator_name text,
  creator_handle text,
  creator_avatar_path text,
  conversation_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select c.id, c.title, c.deliverables, c.amount_twd, c.status::text, c.review_due_at, c.published_url,
         c.created_at, c.updated_at, c.brief_id, b.title,
         case when c.brand_id = v_uid then 'brand' when c.creator_id = v_uid then 'creator' else 'admin' end,
         c.brand_id, bp.brand_name, bp.logo_path,
         c.creator_id, p.display_name, cp.handle, cp.avatar_path,
         c.conversation_id
    from public.collaborations c
    join public.brand_profiles bp on bp.user_id = c.brand_id
    join public.creator_profiles cp on cp.user_id = c.creator_id
    join public.profiles p on p.id = c.creator_id
    left join public.briefs b on b.id = c.brief_id
   where c.id = p_id
     and (c.brand_id = v_uid or c.creator_id = v_uid or public.is_admin());
end;
$$;
revoke execute on function public.get_collaboration(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_collaboration(uuid) to authenticated;
