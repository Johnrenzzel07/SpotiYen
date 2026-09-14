-- SpotiYen admin role + song deletes
-- Run this ONCE in Supabase → SQL Editor (your tables already exist)

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('singer', 'listener', 'admin'));

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

drop policy if exists "admin delete tracks" on public.tracks;
create policy "admin delete tracks"
  on public.tracks for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "admin delete recordings" on storage.objects;
create policy "admin delete recordings"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recordings' and public.is_admin());

-- If you already signed up admin@spotiyen.app as listener, promote it:
-- update public.profiles set role = 'admin' where lower(email) = 'admin@spotiyen.app';
