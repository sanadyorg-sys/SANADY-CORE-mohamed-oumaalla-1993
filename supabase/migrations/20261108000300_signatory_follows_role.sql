-- An approver (partnership signatory) loses that power as soon as their role
-- changes or is removed. Before, removing someone's role left them able to
-- approve contracts, confirm payments and read signed documents.
--
-- 1. Any change or removal of a platform role revokes the approver
--    habilitation (an administrator grants it again if the new role calls for it).
-- 2. Each check also requires a role that may approve, so nothing depends on
--    the revocation alone.
-- 3. Habilitations already held by someone without such a role are revoked now.

create or replace function private.is_partnership_signatory(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.partnership_signatories s
             join public.profiles p on p.id = s.user_id
            where s.user_id = p_user and s.revoked_at is null and p.status = 'active'
         )
     and coalesce(private.platform_role(p_user) in ('sanady_admin', 'partnership_coordinator', 'partnership_manager', 'enterprise_manager'), false)
     and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2');
$$;

create function private.revoke_signatory_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.role is distinct from old.role then
    update public.partnership_signatories
       set revoked_at = now(), revoked_by = auth.uid()
     where user_id = old.user_id and revoked_at is null;
    if found then
      perform private.log_audit('signatory_revoked', 'partnership_signatories', old.user_id, null,
                                jsonb_build_object('reason', 'role_changed'));
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function private.revoke_signatory_on_role_change() from public, anon, authenticated;

create trigger platform_roles_revoke_signatory after update of role or delete on public.platform_roles
  for each row execute function private.revoke_signatory_on_role_change();

update public.partnership_signatories s
   set revoked_at = now()
 where s.revoked_at is null
   and not coalesce(private.platform_role(s.user_id) in ('sanady_admin', 'partnership_coordinator', 'partnership_manager', 'enterprise_manager'), false);
