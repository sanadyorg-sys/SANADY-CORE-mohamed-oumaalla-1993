-- Approvers (partnership signatories) already decide on enterprise proposals,
-- contracts and payments (set_proposal_status, set_contract_status,
-- confirm_payment) and already read contracts and finances. They could not
-- read the proposals themselves, nor the client's name: the approval pages
-- were therefore closed to them. They now read what they approve, from a
-- two-factor session only. Requests, notes, tasks and workspaces stay with the
-- enterprise team.

create function private.is_enterprise_approver(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_partnership_signatory(p_user)
     and (p_user is distinct from auth.uid() or private.session_aal() = 'aal2');
$$;
revoke execute on function private.is_enterprise_approver(uuid) from public, anon, authenticated;
grant execute on function private.is_enterprise_approver(uuid) to authenticated;

drop policy enterprise_proposals_select on public.enterprise_proposals;
create policy enterprise_proposals_select on public.enterprise_proposals for select to authenticated
  using (private.is_enterprise_staff() or private.is_enterprise_approver());

drop policy enterprise_proposal_lines_select on public.enterprise_proposal_lines;
create policy enterprise_proposal_lines_select on public.enterprise_proposal_lines for select to authenticated
  using (private.is_enterprise_staff() or private.is_enterprise_approver());

-- The history of what they approve (proposals and contracts), nothing else.
drop policy enterprise_history_select on public.enterprise_history;
create policy enterprise_history_select on public.enterprise_history for select to authenticated
  using (private.is_enterprise_staff()
         or (private.is_enterprise_approver() and (proposal_id is not null or contract_id is not null)));

-- The client of an enterprise proposal or contract.
drop policy partner_organizations_select on public.partner_organizations;
create policy partner_organizations_select on public.partner_organizations
  for select to authenticated
  using (
    (private.is_partnership_staff() and status is not null)
    or (private.is_enterprise_staff() and enterprise_status is not null)
    or (private.is_enterprise_approver() and enterprise_status is not null)
    or private.is_sanady_admin()
  );
