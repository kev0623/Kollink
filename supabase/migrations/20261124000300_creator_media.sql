-- 創作者頭像與作品圖片（計畫 3）
-- bucket 是公開的：未審核創作者的圖片網址若被猜到也看得到；路徑含亂數（UUID），這點可以接受（見 README）。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-media', 'creator-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 路徑規則與 creator_profiles.avatar_path、creator_portfolio_items.image_path 一致：
-- <uid>/avatar-<檔名> 或 <uid>/portfolio-<檔名>；不可巢狀、不可含 ..
-- 只有創作者可以寫入（my_role() = 'creator'）；品牌與還沒建立帳號的使用者都不行
create policy creator_media_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy creator_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
    and name ~ ('^' || auth.uid()::text || '/(avatar|portfolio)-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy creator_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
    and name ~ ('^' || auth.uid()::text || '/(avatar|portfolio)-[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy creator_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'creator-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'creator'
  );
