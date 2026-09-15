-- SpotiYen schema — paste this once in Supabase → SQL Editor → Run
-- Also turn OFF "Confirm email" in Authentication → Providers → Email
-- so Yen and John can sign in immediately.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null check (role in ('singer', 'listener', 'admin')),
  email text not null unique
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text not null default '',
  mood text not null default '',
  cover_seed integer not null default 0,
  audio_url text not null default '',
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  singer_id uuid not null references public.profiles (id) on delete cascade,
  liked_by_listener boolean not null default false,
  is_sample boolean not null default false,
  cover_url text not null default '',
  lyrics jsonb not null default '[]'::jsonb
);

create index if not exists tracks_created_at_idx on public.tracks (created_at desc);

alter table public.tracks
  add column if not exists cover_url text not null default '';

alter table public.tracks
  add column if not exists lyrics jsonb not null default '[]'::jsonb;

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "tracks readable" on public.tracks;
create policy "tracks readable"
  on public.tracks for select
  to authenticated
  using (true);

alter table public.tracks
  add column if not exists source text not null default 'recording';

drop policy if exists "singer insert tracks" on public.tracks;
drop policy if exists "own insert tracks" on public.tracks;
create policy "own insert tracks"
  on public.tracks for insert
  to authenticated
  with check (singer_id = auth.uid());

drop policy if exists "auth update tracks" on public.tracks;
create policy "auth update tracks"
  on public.tracks for update
  to authenticated
  using (true)
  with check (true);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_set_password(target_id uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can change passwords';
  end if;

  if new_password is null or char_length(new_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = now()
  where id = target_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.admin_set_password(uuid, text) from public;
revoke all on function public.admin_set_password(uuid, text) from anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin delete tracks" on public.tracks;
create policy "admin delete tracks"
  on public.tracks for delete
  to authenticated
  using (public.is_admin());

create or replace function public.admin_set_lyrics(track_id uuid, lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can edit lyrics';
  end if;

  update public.tracks
  set lyrics = coalesce(lines, '[]'::jsonb)
  where id = track_id;

  if not found then
    raise exception 'Song not found';
  end if;
end;
$$;

revoke all on function public.admin_set_lyrics(uuid, jsonb) from public;
revoke all on function public.admin_set_lyrics(uuid, jsonb) from anon;
grant execute on function public.admin_set_lyrics(uuid, jsonb) to authenticated;

create or replace function public.guard_track_lyrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lyrics is distinct from old.lyrics and not public.is_admin() then
    new.lyrics := old.lyrics;
  end if;
  return new;
end;
$$;

drop trigger if exists tracks_guard_lyrics on public.tracks;
create trigger tracks_guard_lyrics
  before update on public.tracks
  for each row
  execute procedure public.guard_track_lyrics();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'role' in ('singer', 'listener', 'admin')
        then new.raw_user_meta_data->>'role'
      else 'listener'
    end,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit)
values ('recordings', 'recordings', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "authenticated read recordings" on storage.objects;
create policy "authenticated read recordings"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recordings');

drop policy if exists "singer upload recordings" on storage.objects;
drop policy if exists "authenticated upload recordings" on storage.objects;
create policy "authenticated upload recordings"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recordings');

drop policy if exists "admin delete recordings" on storage.objects;
create policy "admin delete recordings"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recordings' and public.is_admin());

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

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('album', 'playlist')),
  title text not null,
  note text not null default '',
  cover_seed integer not null default 0,
  cover_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.collections
  add column if not exists cover_url text not null default '';

create table if not exists public.collection_tracks (
  collection_id uuid not null references public.collections (id) on delete cascade,
  track_id uuid not null references public.tracks (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, track_id)
);

alter table public.collections enable row level security;
alter table public.collection_tracks enable row level security;

drop policy if exists "collections readable" on public.collections;
create policy "collections readable"
  on public.collections for select to authenticated using (true);

drop policy if exists "collections insert own" on public.collections;
create policy "collections insert own"
  on public.collections for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "collections update own" on public.collections;
create policy "collections update own"
  on public.collections for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "collections delete own" on public.collections;
create policy "collections delete own"
  on public.collections for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "collection tracks readable" on public.collection_tracks;
create policy "collection tracks readable"
  on public.collection_tracks for select to authenticated using (true);

drop policy if exists "collection tracks insert own" on public.collection_tracks;
create policy "collection tracks insert own"
  on public.collection_tracks for insert to authenticated
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
  );

drop policy if exists "collection tracks delete own" on public.collection_tracks;
create policy "collection tracks delete own"
  on public.collection_tracks for delete to authenticated
  using (
    exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
  );

alter table public.tracks replica identity full;
alter table public.collections replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.tracks;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.collections;
exception
  when duplicate_object then null;
end $$;
