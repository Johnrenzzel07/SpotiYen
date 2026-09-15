-- Karaoke lyrics (text + timestamps)
-- Run this ONCE in Supabase → SQL Editor
-- Requires is_admin() from migrate-admin.sql / schema.sql

alter table public.tracks
  add column if not exists lyrics jsonb not null default '[]'::jsonb;

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
