create policy "anyone uploads pending banners" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = 'pending');
create policy "users upload own banners" on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
