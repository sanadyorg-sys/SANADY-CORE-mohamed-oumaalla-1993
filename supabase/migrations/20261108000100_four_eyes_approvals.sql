-- Four eyes on every approval: the person who approves a proposal, a
-- contract, a partnership agreement or a company's assessment rules, or who
-- records a partnership or a company contract as signed, is never the person
-- who wrote it or sent it for approval. Payments (20261025000100) and data
-- deletion (20261103000100) already follow this rule.
--
-- Enforced by triggers on the tables, so it holds whatever function makes the
-- change. Changes made by the server itself (no user, e.g. maintenance) are
-- not concerned.

-- The last person who moved an item to a status, from its history.
create function private.last_mover(p_kind text, p_id uuid, p_status text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select changed_by from (
    select h.changed_by, h.created_at from public.enterprise_history h
     where p_kind = 'proposal' and h.proposal_id = p_id and h.to_status = p_status
    union all
    select h.changed_by, h.created_at from public.enterprise_history h
     where p_kind = 'contract' and h.contract_id = p_id and h.to_status = p_status
    union all
    select h.changed_by, h.created_at from public.enterprise_history h
     where p_kind = 'enterprise_org' and h.organization_id = p_id and h.to_status = p_status
    union all
    select h.changed_by, h.created_at from public.partnership_status_history h
     where p_kind = 'agreement' and h.agreement_id = p_id and h.to_status = p_status
    union all
    select h.changed_by, h.created_at from public.partnership_status_history h
     where p_kind = 'partner_org' and h.organization_id = p_id and h.to_status = p_status
  ) moves
  order by created_at desc
  limit 1;
$$;
revoke execute on function private.last_mover(text, uuid, text) from public, anon, authenticated;

create function private.require_other_person(p_people uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = any (p_people) then
    raise exception using errcode = 'P0001', message = 'four_eyes';
  end if;
end;
$$;
revoke execute on function private.require_other_person(uuid[]) from public, anon, authenticated;

-- Proposals, contracts and agreements: approved by someone other than their
-- author and than the person who sent them for approval.
create function private.four_eyes_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := case tg_table_name
                   when 'enterprise_proposals' then 'proposal'
                   when 'enterprise_contracts' then 'contract'
                   else 'agreement' end;
begin
  if new.status::text = 'approved' and old.status::text is distinct from 'approved' then
    perform private.require_other_person(array[old.created_by, private.last_mover(v_kind, old.id, 'internal_review')]);
  end if;
  return new;
end;
$$;
revoke execute on function private.four_eyes_approval() from public, anon, authenticated;

create trigger enterprise_proposals_four_eyes before update of status on public.enterprise_proposals
  for each row execute function private.four_eyes_approval();
create trigger enterprise_contracts_four_eyes before update of status on public.enterprise_contracts
  for each row execute function private.four_eyes_approval();
create trigger partnership_agreements_four_eyes before update of status on public.partnership_agreements
  for each row execute function private.four_eyes_approval();

-- A company's assessment rules: approved by someone other than their last editor.
create function private.four_eyes_assessment_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform private.require_other_person(array[old.updated_by]);
  end if;
  return new;
end;
$$;
revoke execute on function private.four_eyes_assessment_policy() from public, anon, authenticated;

create trigger enterprise_assessment_policies_four_eyes before update of status on public.enterprise_assessment_policies
  for each row execute function private.four_eyes_assessment_policy();

-- Organisations: a partnership is recorded as signed by someone other than the
-- person who submitted it for institutional validation; a company contract,
-- by someone other than the person who submitted it for institutional approval.
create function private.four_eyes_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text = 'agreement_signed' and old.status::text is distinct from 'agreement_signed' then
    perform private.require_other_person(array[private.last_mover('partner_org', old.id, 'institutional_validation')]);
  end if;
  if new.enterprise_status::text = 'contract_signed' and old.enterprise_status::text is distinct from 'contract_signed' then
    perform private.require_other_person(array[private.last_mover('enterprise_org', old.id, 'institutional_approval')]);
  end if;
  return new;
end;
$$;
revoke execute on function private.four_eyes_organization() from public, anon, authenticated;

create trigger partner_organizations_four_eyes before update of status, enterprise_status on public.partner_organizations
  for each row execute function private.four_eyes_organization();
