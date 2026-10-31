-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · Two-factor reset from the administration (lost phone)
--
-- The server removes the person's factors with the service key, but only after
-- this function has accepted the request under the administrator's own session
-- and recorded it in the activity log. Nobody can reset their own 2FA here:
-- a stolen session must not be able to remove the protection.
-- ════════════════════════════════════════════════════════════════════════════

create function public.authorize_mfa_reset(p_user uuid, p_factors integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require(private.is_sanady_admin(), 'forbidden');
  perform private.require(p_user <> auth.uid(), 'cannot_reset_own_mfa');
  perform private.require(exists (select 1 from public.profiles where id = p_user), 'not_found');
  perform private.log_audit('mfa_reset', 'profiles', p_user, null, jsonb_build_object('factors', p_factors));
end;
$$;

revoke execute on function public.authorize_mfa_reset(uuid, integer) from public, anon;
grant execute on function public.authorize_mfa_reset(uuid, integer) to authenticated;
