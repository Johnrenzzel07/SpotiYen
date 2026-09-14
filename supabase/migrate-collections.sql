-- SpotiYen collections + shared uploads
-- Run this ONCE in Supabase → SQL Editor (your tables already exist)

alter table public.tracks
  add column if not exists source text not null default 'recording';

alter table public.tracks
  drop constraint if exists tracks_source_check;

alter table public.tracks
  add constraint tracks_source_check
  check (source in ('recording', 'upload'));

drop policy if exists "singer insert tracks" on public.tracks;
drop policy if exists "own insert tracks" on public.tracks;
create policy "own insert tracks"
  on public.tracks for insert
  to authenticated
  with check (singer_id = auth.uid());

drop policy if exists "singer upload recordings" on storage.objects;
drop policy if exists "authenticated upload recordings" on storage.objects;
create policy "authenticated upload recordings"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recordings');

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('album', 'playlist')),
  title text not null,
  note text not null default '',
  cover_seed integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_tracks (
  collection_id uuid not null references public.collections (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, track_id)
);

create index if not exists collections_owner_idx on public.collections (owner_id, created_at desc);
create index if not exists collection_tracks_pos_idx on public.collection_tracks (collection_id, position);

alter table public.collections enable row level security;
alter table public.collection_tracks enable row level security;

drop policy if exists "collections readable" on public.collections;
create policy "collections readable"
  on public.collections for select
  to authenticated
  using (true);

drop policy if exists "collections insert own" on public.collections;
create policy "collections insert own"
  on public.collections for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "collections update own" on public.collections;
create policy "collections update own"
  on public.collections for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "collections delete own" on public.collections;
create policy "collections delete own"
  on public.collections for delete
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "collection tracks readable" on public.collection_tracks;
create policy "collection tracks readable"
  on public.collection_tracks for select
  to authenticated
  using (true);

drop policy if exists "collection tracks insert own" on public.collection_tracks;
create policy "collection tracks insert own"
  on public.collection_tracks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "collection tracks delete own" on public.collection_tracks;
create policy "collection tracks delete own"
  on public.collection_tracks for delete
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

alter table public.collections replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.collections;
exception
  when duplicate_object then null;
end $$;
