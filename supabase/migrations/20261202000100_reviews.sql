-- 評價：合作完成後，品牌與創作者互相評分（1–5 星）並留一段文字。
--
-- 規則（TS 端的對應常數在 src/lib/reviews/view.ts）：
--   * 只有已完成（completed）的合作案能評價；每個合作案每一方一則，送出後不能修改。
--   * 完成後 14 天內可以寫（REVIEW_WINDOW_DAYS）。
--   * 雙盲：雙方都寫完的那一刻一起公開；只有一方寫的話，14 天期滿才公開。
--     公開時間存在 visible_from，查詢只要比 now()，不用每次回頭算對方寫了沒。
--   * 文字最多 500 字（REVIEW_COMMENT_MAX）、不能有聯絡方式或連結（會公開在創作者頁）。
--   * 管理員可以隱藏違規的評價（hidden_at）；隱藏的評價不公開、不列入平均，作者本人仍看得到。
--
-- 資料表不授權給任何 API 角色：讀寫一律經由下面的 definer 函式。

create table public.collaboration_reviews (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations (id),
  author_id uuid not null references public.profiles (id),
  subject_id uuid not null references public.profiles (id),
  author_side text not null check (author_side in ('brand', 'creator')),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 500),
  visible_from timestamptz not null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (collaboration_id, author_side),
  check (author_id <> subject_id)
);
create index collaboration_reviews_subject_idx
  on public.collaboration_reviews (subject_id, visible_from desc) where hidden_at is null;

alter table public.collaboration_reviews enable row level security;
revoke all on public.collaboration_reviews from anon, authenticated, service_role;

-- 1. 合作案完成的時間：audit log 裡轉成 completed 的那一筆（撥款）；沒有的話退回 updated_at。內部 helper。
create function public.collab_completed_at(p_collab_id uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select max(l.created_at) from public.audit_logs l
      where l.collaboration_id = p_collab_id and l.to_status = 'completed'),
    (select c.updated_at from public.collaborations c where c.id = p_collab_id));
$$;
revoke execute on function public.collab_completed_at(uuid) from public, anon, authenticated, service_role;

-- 評價期限的天數（唯一來源；TS 的 REVIEW_WINDOW_DAYS 相同）。內部 helper。
create function public.review_window() returns interval
language sql immutable set search_path = '' as $$ select interval '14 days' $$;
revoke execute on function public.review_window() from public, anon, authenticated, service_role;

-- 2. 送出評價：只有合作案的品牌或創作者。
--    錯誤：42501 not authenticated；P0002 collaboration not found（不是參與者也一樣，不透露是否存在）；
--    55000 collaboration not completed／review window closed／already reviewed；
--    22023 invalid rating／invalid comment／comment has contact info。
create function public.submit_collaboration_review(p_collab_id uuid, p_rating integer, p_comment text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c public.collaborations;
  v_side text;
  v_subject uuid;
  v_comment text := nullif(public.clean_text(p_comment), '');
  v_closes timestamptz;
  v_other boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- 鎖住合作案：雙方同時送出時依序處理，visible_from 才不會算錯
  select * into c from public.collaborations x where x.id = p_collab_id for update;
  if not found or v_uid not in (c.brand_id, c.creator_id) then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if c.brand_id = v_uid then
    v_side := 'brand'; v_subject := c.creator_id;
  else
    v_side := 'creator'; v_subject := c.brand_id;
  end if;
  if c.status <> 'completed' then
    raise exception 'collaboration not completed' using errcode = '55000';
  end if;
  v_closes := public.collab_completed_at(c.id) + public.review_window();
  if now() > v_closes then
    raise exception 'review window closed' using errcode = '55000';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid rating' using errcode = '22023';
  end if;
  if v_comment is not null and (char_length(v_comment) > 500 or public.has_bidi(v_comment)) then
    raise exception 'invalid comment' using errcode = '22023';
  end if;
  if v_comment is not null and public.has_contact_info(v_comment) then
    raise exception 'comment has contact info' using errcode = '22023';
  end if;
  if exists (select 1 from public.collaboration_reviews r
              where r.collaboration_id = c.id and r.author_side = v_side) then
    raise exception 'already reviewed' using errcode = '55000';
  end if;

  v_other := exists (select 1 from public.collaboration_reviews r where r.collaboration_id = c.id);
  insert into public.collaboration_reviews
    (collaboration_id, author_id, subject_id, author_side, rating, comment, visible_from)
  values (c.id, v_uid, v_subject, v_side, p_rating, v_comment,
          case when v_other then now() else v_closes end);
  -- 對方已經寫了：兩則一起公開
  if v_other then
    update public.collaboration_reviews r set visible_from = now()
     where r.collaboration_id = c.id and r.author_side <> v_side and r.visible_from > now();
  end if;
end;
$$;
revoke execute on function public.submit_collaboration_review(uuid, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_collaboration_review(uuid, integer, text) to authenticated;

-- 3. 合作案詳情的評價區：只給參與者，永遠回傳一列；不是參與者或合作案還沒完成不回傳任何列。
--    their_*：對方的評價，公開之後才有內容（their_submitted 只說對方寫了沒）。
--    被管理員隱藏的評價：作者自己照樣看得到（my_hidden = true）；對方的被隱藏時 their_published = false、內容是 null。
create function public.get_collaboration_reviews(p_collab_id uuid)
returns table (
  closes_at timestamptz,
  can_review boolean,
  my_rating integer,
  my_comment text,
  my_created_at timestamptz,
  my_hidden boolean,
  their_submitted boolean,
  their_published boolean,
  their_rating integer,
  their_comment text,
  their_created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  c public.collaborations;
  v_side text;
  v_closes timestamptz;
  mine public.collaboration_reviews;
  theirs public.collaboration_reviews;
  v_pub boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into c from public.collaborations x where x.id = p_collab_id;
  if not found or v_uid not in (c.brand_id, c.creator_id) or c.status <> 'completed' then
    return;
  end if;
  v_side := case when c.brand_id = v_uid then 'brand' else 'creator' end;
  v_closes := public.collab_completed_at(c.id) + public.review_window();
  select * into mine from public.collaboration_reviews r
   where r.collaboration_id = c.id and r.author_side = v_side;
  select * into theirs from public.collaboration_reviews r
   where r.collaboration_id = c.id and r.author_side <> v_side;
  v_pub := theirs.id is not null and theirs.visible_from <= now() and theirs.hidden_at is null;
  return query select
    v_closes,
    mine.id is null and now() <= v_closes,
    mine.rating::integer, mine.comment, mine.created_at, mine.hidden_at is not null,
    theirs.id is not null,
    v_pub,
    case when v_pub then theirs.rating::integer end,
    case when v_pub then theirs.comment end,
    case when v_pub then theirs.created_at end;
end;
$$;
revoke execute on function public.get_collaboration_reviews(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_collaboration_reviews(uuid) to authenticated;

-- 4. 評分統計（平均、則數、完成的合作案數）：一次查多個人（最多 100 個 id，多的忽略）。
--    創作者：已審核的給所有人（含訪客，公開頁要用）；未審核的只有本人。
--    品牌：登入的人都查得到（創作者在機會頁看品牌評分；只有彙總數字，沒有個別內容）。
--    查不到的 id 不回傳列。平均四捨五入到小數一位；沒有評價時 avg_rating 是 null。
create function public.review_stats(p_user_ids uuid[])
returns table (user_id uuid, avg_rating numeric, review_count integer, completed_count integer)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select round(avg(r.rating), 1) from public.collaboration_reviews r
           where r.subject_id = p.id and r.visible_from <= now() and r.hidden_at is null),
         (select count(*)::integer from public.collaboration_reviews r
           where r.subject_id = p.id and r.visible_from <= now() and r.hidden_at is null),
         (select count(*)::integer from public.collaborations c
           where c.status = 'completed' and p.id in (c.brand_id, c.creator_id))
    from public.profiles p
   where p.id in (select u from unnest(p_user_ids[1:100]) as u)
     and (
       (p.role = 'creator' and exists (
          select 1 from public.creator_profiles cp
           where cp.user_id = p.id and (cp.status = 'approved' or cp.user_id = auth.uid())))
       or (p.role = 'brand' and auth.uid() is not null)
     );
$$;
revoke execute on function public.review_stats(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.review_stats(uuid[]) to anon, authenticated;

-- 5. 創作者公開頁的評價列表（品牌寫給這位創作者的，已公開、沒被隱藏）：新的在前。
--    看得到的條件與 get_public_creator 相同：已審核的給所有人，未審核的只有本人。
--    p_limit 夾在 1..50（TS 的 REVIEW_PAGE_SIZE = 10）；p_offset 夾在 0..100000。
create function public.list_creator_reviews(p_creator_id uuid, p_limit integer default 10, p_offset integer default 0)
returns table (
  id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  brand_name text,
  brand_logo_path text
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating::integer, r.comment, r.created_at, bp.brand_name, bp.logo_path
    from public.collaboration_reviews r
    join public.creator_profiles cp on cp.user_id = r.subject_id
    join public.brand_profiles bp on bp.user_id = r.author_id
   where r.subject_id = p_creator_id
     and r.author_side = 'brand'
     and r.visible_from <= now()
     and r.hidden_at is null
     and (cp.status = 'approved' or cp.user_id = auth.uid())
   order by r.visible_from desc, r.id
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 100000);
$$;
revoke execute on function public.list_creator_reviews(uuid, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.list_creator_reviews(uuid, integer, integer) to anon, authenticated;

-- 6. 管理員：一個合作案的兩則評價（含還沒公開與已隱藏的）。
create function public.admin_list_collab_reviews(p_collab_id uuid)
returns table (
  id uuid,
  author_side text,
  rating integer,
  comment text,
  created_at timestamptz,
  visible_from timestamptz,
  hidden_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_actor();
  return query
  select r.id, r.author_side, r.rating::integer, r.comment, r.created_at, r.visible_from, r.hidden_at
    from public.collaboration_reviews r
   where r.collaboration_id = p_collab_id
   order by r.author_side;
end;
$$;
revoke execute on function public.admin_list_collab_reviews(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_collab_reviews(uuid) to authenticated, service_role;

-- 7. 管理員：隱藏或恢復一則評價。原因必填（寫進 audit，subject_id = 被評價的人；合作案的事件列表不顯示，
--    所以 collaboration_id 留 null，原因只有管理員看得到）。管理員是這個合作案的參與者時不能處理。
--    狀態沒變（已經隱藏又隱藏）回傳 false、不寫 audit。
create function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_actor text := public.admin_actor();
  v_reason text := public.admin_clean_note(p_reason, 'reason');
  r public.collaboration_reviews;
begin
  select * into r from public.collaboration_reviews x where x.id = p_review_id for update;
  if not found then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  if v_actor = 'admin' and auth.uid() in (r.author_id, r.subject_id) then
    raise exception 'admin is participant' using errcode = '42501';
  end if;
  if p_hidden is null or (r.hidden_at is not null) = p_hidden then
    return false;
  end if;
  update public.collaboration_reviews x
     set hidden_at = case when p_hidden then now() end
   where x.id = r.id;
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, subject_id, note)
  values (null, case when v_actor = 'admin' then auth.uid() end, v_actor,
          case when p_hidden then 'review_hidden' else 'review_unhidden' end, r.subject_id,
          'review ' || r.id::text || '：' || v_reason);
  return true;
end;
$$;
revoke execute on function public.admin_set_review_hidden(uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated, service_role;
