-- 合作案（計畫 6）之一：建立合作案只能經由 definer 函式（招募錄取、直接邀請）、收回直接 insert、索引。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會；見 20261124000100_explicit_api_grants.sql）。

-- 1. 收回直接建立：計畫 1 開放了品牌直接 insert collaborations、參與者直接 insert conversations，
--    20261124000100 還誤給了 anon insert conversations。全部收回，只留 SELECT（RLS 照舊）。
drop policy collaborations_insert_brand on public.collaborations;
drop policy conversations_insert_participant on public.conversations;
revoke all on public.collaborations from anon, authenticated, service_role;
grant select on public.collaborations to authenticated, service_role;
revoke all on public.conversations from anon, authenticated, service_role;
grant select on public.conversations to authenticated, service_role;

-- 2. 索引（followups「4. 創作者廣場、5. 招募與機會頁」）。
--    (brief_id, creator_id) 唯一：同一則招募的同一位創作者（= 同一則報名）只能有一個合作案；也當 brief_id 的索引用。
create index conversations_creator_idx on public.conversations (creator_id);
create index collaborations_conversation_idx on public.collaborations (conversation_id);
create unique index collaborations_brief_creator_key on public.collaborations (brief_id, creator_id)
  where brief_id is not null;

-- 3. 取得（或建立）品牌與創作者之間唯一的對話，並鎖住這一列：
--    同一對品牌／創作者的建立動作因此一個一個來，「不能重複邀約」的檢查不會有競態。只給 definer 函式內部用。
create function public.ensure_conversation(p_brand_id uuid, p_creator_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.conversations (brand_id, creator_id) values (p_brand_id, p_creator_id)
  on conflict (brand_id, creator_id) do nothing;
  select cv.id into v_id from public.conversations cv
   where cv.brand_id = p_brand_id and cv.creator_id = p_creator_id
   for update;
  return v_id;
end;
$$;
revoke execute on function public.ensure_conversation(uuid, uuid) from public, anon, authenticated, service_role;

-- 4. 合作條件的格式（與 src/lib/validation/collab.ts 相同規則）：
--    案名 1–60 字、交付內容 1–1000 字（都先 clean_text、不可有 bidi）、金額 1..10,000,000。
--    回傳清理後的文字；不合格就丟 22023 invalid <欄位>。只給 definer 函式內部用。
create function public.check_collab_offer(p_title text, p_deliverables text, p_amount_twd integer)
returns table (title text, deliverables text)
language plpgsql immutable set search_path = '' as $$
declare
  v_title text := nullif(public.clean_text(p_title), '');
  v_deliverables text := nullif(public.clean_text(p_deliverables), '');
begin
  if v_title is null or public.has_bidi(v_title) or char_length(v_title) > 60 then
    raise exception 'invalid title' using errcode = '22023';
  end if;
  if v_deliverables is null or public.has_bidi(v_deliverables) or char_length(v_deliverables) > 1000 then
    raise exception 'invalid deliverables' using errcode = '22023';
  end if;
  if p_amount_twd is null or p_amount_twd not between 1 and 10000000 then
    raise exception 'invalid amount_twd' using errcode = '22023';
  end if;
  return query select v_title, v_deliverables;
end;
$$;
revoke execute on function public.check_collab_offer(text, text, integer) from public, anon, authenticated, service_role;

-- 5. 招募主錄取報名並建立合作案（同一個 transaction）：報名 → accepted、取得或建立對話、
--    建立合作案（awaiting_payment，創作者報名時已同意，跳過邀約）。案名 = 招募名稱。回傳合作案 id。
--    招募關閉或截止後也可以錄取（同計畫 5）。
create function public.accept_application_with_collab(
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

-- 6. 計畫 5 的 decide_application 只剩婉拒：錄取必須帶金額與交付內容，改走 accept_application_with_collab。
create or replace function public.decide_application(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_accept is distinct from false then
    raise exception 'invalid accept' using errcode = '22023';
  end if;
  update public.brief_applications a
     set status = 'rejected'
    from public.briefs b
   where a.id = p_id and b.id = a.brief_id and b.brand_id = v_uid and a.status = 'applied';
  if not found then
    if exists (select 1 from public.brief_applications a join public.briefs b on b.id = a.brief_id
                where a.id = p_id and b.brand_id = v_uid) then
      raise exception 'application not pending' using errcode = '55000';
    end if;
    raise exception 'application not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.decide_application(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.decide_application(uuid, boolean) to authenticated;

-- 7. 品牌直接邀請已審核的創作者：取得或建立對話、建立合作案（invited）。回傳合作案 id。
--    同一個品牌對同一位創作者已有 invited 的合作案時不能再邀（23505 already invited）。
--    未審核、停權或不存在的創作者一律 P0002（不透露是否存在）。
create function public.invite_creator(
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

-- 8. 報名者列表多回傳 collaboration_id（已錄取的那一筆可以直接連到合作案）。回傳欄位變了，要先 drop。
drop function public.list_brief_applicants(uuid);
create function public.list_brief_applicants(p_brief_id uuid)
returns table (
  id uuid,
  creator_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  follower_count integer,
  engagement_rate numeric,
  region text,
  message text,
  proposed_price_twd integer,
  status text,
  created_at timestamptz,
  collaboration_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null
     or not exists (select 1 from public.briefs b where b.id = p_brief_id and b.brand_id = auth.uid()) then
    raise exception 'not brief owner' using errcode = '42501';
  end if;
  return query
  select a.id, a.creator_id, cp.handle, p.display_name, cp.avatar_path, cp.follower_count,
         cp.engagement_rate::numeric, cp.region, a.message, a.proposed_price_twd, a.status, a.created_at,
         c.id
    from public.brief_applications a
    join public.creator_profiles cp on cp.user_id = a.creator_id
    join public.profiles p on p.id = a.creator_id
    left join public.collaborations c on c.brief_id = a.brief_id and c.creator_id = a.creator_id
   where a.brief_id = p_brief_id
   order by a.created_at desc, a.id;
end;
$$;
revoke execute on function public.list_brief_applicants(uuid) from public, anon, authenticated, service_role;
grant execute on function public.list_brief_applicants(uuid) to authenticated;
