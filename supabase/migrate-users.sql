-- Admin can edit any profile (name and role) and set passwords
-- Re-run this any time; it is safe to paste again.

drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

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
