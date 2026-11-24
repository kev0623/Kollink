-- 招募封面圖（計畫 5）
-- bucket 是公開的：草稿的封面網址若被猜到也看得到；路徑含 UUID，與 creator-media 相同的取捨（見 README）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brief-covers', 'brief-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 路徑規則與 briefs.cover_path 一致：<uid>/cover-<檔名>；不可巢狀、不可含 ..
-- 只有品牌可以寫入（my_role() = 'brand'）；創作者與還沒建立帳號的使用者都不行
create policy brief_covers_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'brief-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy brief_covers_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brief-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'brand'
    and name ~ ('^' || auth.uid()::text || '/cover-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy brief_covers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'brief-covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'brief-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'brand'
    and name ~ ('^' || auth.uid()::text || '/cover-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy brief_covers_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brief-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'brand'
  );
