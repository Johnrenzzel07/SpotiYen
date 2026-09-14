-- Album and playlist cover photos
-- Run this ONCE in Supabase → SQL Editor

alter table public.collections
  add column if not exists cover_url text not null default '';

insert into storage.buckets (id, name, public, file_size_limit)
values ('covers', 'covers', true, 5242880)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880;

drop policy if exists "covers public read" on storage.objects;
create policy "covers public read"
  on storage.objects for select
  using (bucket_id = 'covers');

drop policy if exists "covers authenticated upload" on storage.objects;
create policy "covers authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "covers owner update" on storage.objects;
create policy "covers owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'covers'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'covers'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "covers owner delete" on storage.objects;
create policy "covers owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and split_part(name, '/', 1) = auth.uid()::text
  );
