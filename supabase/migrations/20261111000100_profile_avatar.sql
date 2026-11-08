-- ════════════════════════════════════════════════════════════════════════════
-- SANADY — profile photo chosen by the account owner (mobile app, website later)
--
-- One JPEG per person, re-encoded by the app (square, 512 px, < 1 MB), stored
-- in a private bucket under the owner's folder: `{user_id}/avatar-{n}.jpg`.
--
-- Privacy: the photo is visible to its OWNER ONLY. The consent text shown when
-- joining an institution lists exactly what the institution sees (name,
-- e-mail, job title, subject, phone, membership date, progress on assigned
-- courses); a photo is not on that list, so institutions and staff do not get
-- read access. Widening it requires updating the consent text and the privacy
-- notice first.
--
-- Storage files cannot be deleted from SQL: `set_profile_avatar` returns the
-- previous path so the client deletes the old file (owner delete policy).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column avatar_path       text check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9]+\.jpg$'),
  add column avatar_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Owner only, active accounts only, own folder only, strict file name.
create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy avatars_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/avatar-[0-9]+\.jpg$'
    and private.is_active_user()
  );

create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- Records (or removes, with null) the caller's photo. Returns the previous
-- path so the client can delete the old file.
create function public.set_profile_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
begin
  perform private.require(v_uid is not null, 'not_authenticated');
  perform private.require(private.is_active_user(v_uid), 'account_unavailable');
  perform private.require(
    p_path is null
    or (split_part(p_path, '/', 1) = v_uid::text
        and p_path ~ '^[0-9a-f-]{36}/avatar-[0-9]+\.jpg$'
        and exists (select 1 from storage.objects where bucket_id = 'avatars' and name = p_path)),
    'invalid_input');

  select avatar_path into v_old from public.profiles where id = v_uid for update;
  update public.profiles
     set avatar_path = p_path,
         avatar_updated_at = case when p_path is null then null else now() end
   where id = v_uid;
  return v_old;
end;
$$;
revoke execute on function public.set_profile_avatar(text) from public, anon;
grant execute on function public.set_profile_avatar(text) to authenticated;
