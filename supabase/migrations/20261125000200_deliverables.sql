-- 合作案（計畫 6）之二：交稿。私密 bucket deliverables、交稿紀錄 collaboration_submissions、submit_deliverables。
-- 權限一律在這裡明確寫出（雲端新專案不會自動授權，本機會）。

-- 1. 私密 bucket：50 MB；圖片、影片、PDF。路徑 <collab_id>/<creator_id>/<uuid>.<副檔名>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverables', 'deliverables', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 路徑格式（與 src/lib/deliverables.ts 的 DELIVERABLE_NAME_RE 相同）：檔名是 uuid + 允許的副檔名
create function public.deliverable_path_ok(p_collab_id uuid, p_creator_id uuid, p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    p_name ~ ('^' || p_collab_id::text || '/' || p_creator_id::text
              || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|mov|pdf)$'),
    false);
$$;
revoke execute on function public.deliverable_path_ok(uuid, uuid, text) from public, anon, authenticated, service_role;

-- 2. 交稿紀錄：只能經由 submit_deliverables 寫入；雙方與管理員可讀
create table public.collaboration_submissions (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations (id),
  round integer not null check (round >= 1),
  note text check (note is null or char_length(note) between 1 and 1000),
  links text[] not null default '{}'
    check (cardinality(links) <= 5 and public.text_items_within(links, 500)),
  file_paths text[] not null default '{}' check (cardinality(file_paths) <= 10),
  created_at timestamptz not null default now(),
  unique (collaboration_id, round),
  check (cardinality(links) + cardinality(file_paths) >= 1)
);
-- unique (collaboration_id, round) 本身就是 (collaboration_id, round) 的索引

alter table public.collaboration_submissions enable row level security;
create policy collaboration_submissions_select on public.collaboration_submissions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
       where c.id = collaboration_submissions.collaboration_id
         and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
revoke all on public.collaboration_submissions from anon, authenticated, service_role;
grant select on public.collaboration_submissions to authenticated, service_role;

-- 3. Storage policy 用的 helper（definer：讀合作案與交稿紀錄時不經過 RLS）
-- 讀取：該合作案的品牌、創作者或管理員
create function public.can_read_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.collaborations c
       where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
         and c.id = split_part(p_name, '/', 1)::uuid
         and (c.brand_id = auth.uid() or c.creator_id = auth.uid())
    )
  );
$$;
-- 上傳：只有該合作案的創作者、寫在自己的資料夾、合作案在 awaiting_submission、檔名合規
create function public.can_upload_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.collaborations c
     where p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
       and c.id = split_part(p_name, '/', 1)::uuid
       and c.creator_id = auth.uid()
       and c.status = 'awaiting_submission'
       and public.deliverable_path_ok(c.id, c.creator_id, p_name)
  );
$$;
-- 刪除：只有上傳的創作者本人、而且這個檔案還沒出現在任何一次交稿紀錄裡
create function public.can_delete_deliverable(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and split_part(p_name, '/', 2) = auth.uid()::text
    and not exists (
      select 1 from public.collaboration_submissions s where p_name = any (s.file_paths)
    );
$$;
revoke execute on function public.can_read_deliverable(text) from public, anon, authenticated, service_role;
revoke execute on function public.can_upload_deliverable(text) from public, anon, authenticated, service_role;
revoke execute on function public.can_delete_deliverable(text) from public, anon, authenticated, service_role;
grant execute on function public.can_read_deliverable(text) to authenticated;
grant execute on function public.can_upload_deliverable(text) to authenticated;
grant execute on function public.can_delete_deliverable(text) to authenticated;

-- 沒有 update policy：交出去的檔案不能被換掉（上傳一律 upsert = false）
create policy deliverables_select on storage.objects
  for select to authenticated
  using (bucket_id = 'deliverables' and public.can_read_deliverable(name));
create policy deliverables_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'deliverables' and public.can_upload_deliverable(name));
create policy deliverables_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'deliverables' and public.can_delete_deliverable(name));

-- 4. 創作者交稿：在同一個 transaction 新增交稿紀錄並把合作案推進到 in_review。回傳第幾次交稿。
--    說明 ≤ 1000 字；連結 ≤ 5 個 https 網址、每個 ≤ 500 字；檔案 ≤ 10 個、不重複、
--    必須是這個合作案創作者資料夾裡、已經上傳的物件。檔案或連結至少一個。
create function public.submit_deliverables(
  p_collab_id uuid, p_note text default null, p_links text[] default '{}', p_file_paths text[] default '{}'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c public.collaborations%rowtype;
  v_note text := nullif(public.clean_text(p_note), '');
  v_links text[];
  v_files text[] := coalesce(p_file_paths, '{}');
  v_round integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into c from public.collaborations where id = p_collab_id for update;
  if not found or (c.brand_id <> v_uid and c.creator_id <> v_uid) then
    raise exception 'collaboration not found' using errcode = 'P0002';
  end if;
  if c.creator_id <> v_uid then
    raise exception 'not collaboration creator' using errcode = '42501';
  end if;
  if c.status <> 'awaiting_submission' then
    raise exception 'collaboration not awaiting submission' using errcode = '55000';
  end if;
  if v_note is not null and (public.has_bidi(v_note) or char_length(v_note) > 1000) then
    raise exception 'invalid note' using errcode = '22023';
  end if;
  select coalesce(array_agg(public.clean_text(l) order by o), '{}') into v_links
    from unnest(coalesce(p_links, '{}')) with ordinality as t(l, o);
  if cardinality(v_links) > 5 or exists (
       select 1 from unnest(v_links) l
        where l is null or char_length(l) > 500 or public.has_bidi(l)
           or l !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/\S*)?$'
     ) then
    raise exception 'invalid links' using errcode = '22023';
  end if;
  if cardinality(v_files) > 10
     or cardinality(v_files) <> (select count(distinct f) from unnest(v_files) f)
     or exists (
       select 1 from unnest(v_files) f
        where f is null
           or not public.deliverable_path_ok(c.id, c.creator_id, f)
           or not exists (select 1 from storage.objects o where o.bucket_id = 'deliverables' and o.name = f)
     ) then
    raise exception 'invalid file_paths' using errcode = '22023';
  end if;
  if cardinality(v_links) + cardinality(v_files) = 0 then
    raise exception 'empty submission' using errcode = '22023';
  end if;

  select coalesce(max(s.round), 0) + 1 into v_round
    from public.collaboration_submissions s where s.collaboration_id = c.id;
  insert into public.collaboration_submissions (collaboration_id, round, note, links, file_paths)
  values (c.id, v_round, v_note, v_links, v_files);
  perform public.transition_collaboration(c.id, 'submit');
  return v_round;
end;
$$;
revoke execute on function public.submit_deliverables(uuid, text, text[], text[]) from public, anon, authenticated, service_role;
grant execute on function public.submit_deliverables(uuid, text, text[], text[]) to authenticated;
