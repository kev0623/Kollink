-- 合作案、audit log、狀態轉換

create type public.collab_status as enum (
  'invited', 'awaiting_payment', 'awaiting_submission', 'in_review',
  'awaiting_publish', 'awaiting_payout', 'completed', 'declined', 'cancelled'
);

create table public.collaborations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles (user_id),
  creator_id uuid not null references public.creator_profiles (user_id),
  brief_id uuid references public.briefs (id),
  conversation_id uuid not null references public.conversations (id),
  title text not null,
  deliverables text not null,
  amount_twd integer not null check (amount_twd > 0),
  status public.collab_status not null default 'invited',
  review_due_at timestamptz,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collaborations_brand_idx on public.collaborations (brand_id, status);
create index collaborations_creator_idx on public.collaborations (creator_id, status);
create index collaborations_review_due_idx on public.collaborations (review_due_at)
  where status = 'in_review';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  collaboration_id uuid references public.collaborations (id),
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('brand', 'creator', 'admin', 'system')),
  action text not null,
  from_status public.collab_status,
  to_status public.collab_status,
  note text,
  created_at timestamptz not null default now()
);
create index audit_logs_collaboration_idx on public.audit_logs (collaboration_id, created_at);

-- audit log 只能新增：撤銷所有角色的寫入權限，再用 trigger 擋下擁有者
revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated, service_role;

create function public.audit_logs_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.audit_logs_block_mutation();

-- 建立合作案時自動寫入 audit log
create function public.log_collaboration_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status)
  values (
    new.id,
    auth.uid(),
    case when auth.uid() = new.brand_id then 'brand' else 'system' end,
    'create',
    null,
    new.status
  );
  return new;
end;
$$;
create trigger collaborations_audit_insert after insert on public.collaborations
  for each row execute function public.log_collaboration_created();

-- 狀態轉換：唯一可以改變合作狀態的入口
create function public.transition_collaboration(
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
begin
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found then
    raise exception 'collaboration % not found', p_collab_id using errcode = 'P0002';
  end if;

  if coalesce(auth.role(), '') = 'service_role' then
    v_actor := 'system';
  elsif public.is_admin() then
    v_actor := 'admin';
  elsif v_uid = c.brand_id then
    v_actor := 'brand';
  elsif v_uid = c.creator_id then
    v_actor := 'creator';
  else
    raise exception 'not a participant of collaboration %', p_collab_id using errcode = '42501';
  end if;

  v_to := case
    when c.status = 'invited' and p_action = 'accept' and v_actor = 'creator'
      then 'awaiting_payment'::public.collab_status
    when c.status = 'invited' and p_action = 'decline' and v_actor = 'creator'
      then 'declined'::public.collab_status
    when c.status in ('invited', 'awaiting_payment') and p_action = 'cancel' and v_actor = 'brand'
      then 'cancelled'::public.collab_status
    when c.status = 'awaiting_payment' and p_action = 'mark_paid' and v_actor = 'system'
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_submission' and p_action = 'submit' and v_actor = 'creator'
      then 'in_review'::public.collab_status
    when c.status = 'in_review' and p_action = 'approve' and v_actor = 'brand'
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'auto_approve' and v_actor = 'system'
         and c.review_due_at <= now()
      then 'awaiting_publish'::public.collab_status
    when c.status = 'in_review' and p_action = 'request_changes' and v_actor = 'brand'
         and nullif(trim(p_note), '') is not null
      then 'awaiting_submission'::public.collab_status
    when c.status = 'awaiting_publish' and p_action = 'publish' and v_actor = 'creator'
         and p_published_url ~ '^https://'
      then 'awaiting_payout'::public.collab_status
    when c.status = 'awaiting_payout' and p_action = 'payout' and v_actor in ('admin', 'system')
      then 'completed'::public.collab_status
    else null
  end;

  if v_to is null then
    raise exception 'invalid transition: % from % by %', p_action, c.status, v_actor
      using errcode = '22023';
  end if;

  update public.collaborations
  set status = v_to,
      updated_at = now(),
      review_due_at = case when v_to = 'in_review' then now() + interval '3 days' else review_due_at end,
      published_url = case when v_to = 'awaiting_payout' then p_published_url else published_url end
  where id = c.id;

  insert into public.audit_logs (collaboration_id, actor_id, actor_kind, action, from_status, to_status, note)
  values (c.id, case when v_actor = 'system' then null else v_uid end, v_actor, p_action, c.status, v_to, p_note);

  return v_to;
end;
$$;

revoke execute on function public.transition_collaboration(uuid, text, text, text) from public, anon;
grant execute on function public.transition_collaboration(uuid, text, text, text) to authenticated, service_role;

alter table public.collaborations enable row level security;
alter table public.audit_logs enable row level security;

-- collaborations：參與者與管理員可讀；只有品牌能建立邀約；任何人都不能直接 UPDATE / DELETE
create policy collaborations_select on public.collaborations
  for select to authenticated
  using (brand_id = auth.uid() or creator_id = auth.uid() or public.is_admin());
create policy collaborations_insert_brand on public.collaborations
  for insert to authenticated
  with check (
    brand_id = auth.uid()
    and public.my_role() = 'brand'
    and status = 'invited'
    -- 子查詢裡的欄位必須寫出外層表名；只寫 brand_id 會被解析成 cv.brand_id，條件永遠成立
    and exists (
      select 1 from public.conversations cv
      where cv.id = collaborations.conversation_id
        and cv.brand_id = collaborations.brand_id
        and cv.creator_id = collaborations.creator_id
    )
  );
revoke insert, update, delete on public.collaborations from anon, authenticated;
grant insert (id, brand_id, creator_id, brief_id, conversation_id, title, deliverables, amount_twd)
  on public.collaborations to authenticated;

-- audit_logs：合作案參與者與管理員可讀
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
      where c.id = collaboration_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );

-- 地基硬化規則：收回 anon / authenticated 的 truncate、trigger、references 權限
revoke truncate, trigger, references on public.collaborations from anon, authenticated;
revoke truncate, trigger, references on public.audit_logs from anon, authenticated;
