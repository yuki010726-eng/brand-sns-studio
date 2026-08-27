insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instagram-publish', 'instagram-publish', true, 10485760, array['image/png'])
on conflict (id) do update set public = true;

create policy "Users upload own Instagram publish files"
on storage.objects for insert to authenticated
with check (bucket_id = 'instagram-publish' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own Instagram publish files"
on storage.objects for delete to authenticated
using (bucket_id = 'instagram-publish' and (storage.foldername(name))[1] = auth.uid()::text);
