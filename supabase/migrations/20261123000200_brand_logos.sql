-- 品牌 Logo（計畫 2）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 檔名規則與 brand_profiles.logo_path 一致：<uid>/<檔名>，不可巢狀資料夾、不可以 . 或 - 開頭、不可含 ..
-- 可寫入者：品牌，或還沒建立帳號的使用者（品牌註冊時先上傳 Logo 再建立帳號）；創作者不行
create policy brand_logos_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy brand_logos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() is distinct from 'creator'
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy brand_logos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() is distinct from 'creator'
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
    and name !~ '\.\.'
  );
create policy brand_logos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-logos' and (storage.foldername(name))[1] = auth.uid()::text);
