/**
 * Four eyes on approvals: an approver never approves what they wrote or sent
 * for approval — proposals, contracts, agreements, a company's assessment
 * rules, and the signature of a partnership or a company contract.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string; // enterprise manager AND approver
let partner: string; // partnership manager AND approver
let approver: string; // another approver
let slug: string;

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const other = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    await db.rpc(other, "set_partnership_signatory", [id, true]);
    return id;
  };
  manager = await staff("enterprise_manager");
  partner = await staff("partnership_manager");
  approver = await staff("partnership_manager");
  const [f] = await db.sql<{ slug: string }>(`select slug from public.intervention_fields order by position limit 1`);
  slug = f!.slug;
});
afterAll(async () => db?.close());

async function organization(columns: string, values: string) {
  const [o] = await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, ${columns}) values ($1, 'entreprise', ${values}) returning id`, [`Org ${uid()}`]);
  return o!.id;
}

async function proposal(org: string, status: string, createdBy: string | null = null) {
  const [p] = await db.sql<{ id: string }>(
    `insert into public.enterprise_proposals (reference, organization_id, title, service, currency, status, created_by) values ($1, $2, 'Formation', 'complete', 'MAD', $3, $4) returning id`,
    [`PROP-4E-${uid()}`, org, status, createdBy],
  );
  await db.sql(
    `insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit, unit_price, position) values ($1, 'platform_access', 'Accès', 12, 'mois', 2000, 0)`,
    [p!.id],
  );
  return p!.id;
}

describe("four eyes on approvals", () => {
  it("proposal: not approved by whoever sent it for approval, nor by its author", async () => {
    const org = await organization("status, enterprise_status", "null, 'proposal'");
    const p = await proposal(org, "draft");
    await db.rpc(manager, "set_proposal_status", [p, "internal_review", null]);
    expect(await db.rpcError(manager, "set_proposal_status", [p, "approved", null])).toMatch(/four_eyes/);
    await db.rpc(approver, "set_proposal_status", [p, "approved", null]);

    const q = await proposal(org, "draft", approver);
    await db.rpc(manager, "set_proposal_status", [q, "internal_review", null]);
    expect(await db.rpcError(approver, "set_proposal_status", [q, "approved", null])).toMatch(/four_eyes/);
    await db.rpc(partner, "set_proposal_status", [q, "approved", null]);
  });

  it("contract: not approved by the manager who drafted and submitted it", async () => {
    const org = await organization("status, enterprise_status", "null, 'active_service'");
    const p = await proposal(org, "accepted");
    const contract = await db.rpc<string>(manager, "create_contract_from_proposal", [p]);
    await db.rpc(manager, "save_enterprise_contract", [
      contract,
      JSON.stringify({ title: "Contrat", pricing_model: "per_enrolled_learner", currency: "MAD", start_on: "2026-01-01", end_on: "2026-12-31", learner_limit: "2", storage_limit_gb: "1" }),
    ]);
    await db.rpc(manager, "set_contract_status", [contract, "internal_review", "{}"]);
    expect(await db.rpcError(manager, "set_contract_status", [contract, "approved", "{}"])).toMatch(/four_eyes/);
    await db.rpc(approver, "set_contract_status", [contract, "approved", "{}"]);
  });

  it("company assessment rules: not approved by their last editor", async () => {
    const org = await organization("enterprise_status", "'active_service'");
    await db.sql(`select set_config('sanady.tenant_sync', 'on', false)`);
    const [i] = await db.sql<{ id: string }>(`insert into public.institutions (name, identifier, type, contact_email, kind) values ('Client', $1, 'autre', 'c@c.test', 'enterprise') returning id`, [`ENT-4E-${uid().toUpperCase()}`]);
    const [t] = await db.sql<{ id: string }>(
      `insert into public.enterprise_tenants (organization_id, institution_id, slug, display_name, service_plan, max_learners, status, activated_at) values ($1, $2, $3, 'Client', 'complete', 10, 'active', now()) returning id`,
      [org, i!.id, `client-${uid()}`],
    );
    await db.sql(`select set_config('sanady.tenant_sync', '', false)`);
    await db.rpc(manager, "save_assessment_policy", [t!.id, JSON.stringify({ pass_threshold: 80, max_attempts: 2, feedback: "never", certificates: false, enforce_due_dates: true, note: "Règles" })]);
    expect(await db.rpcError(manager, "approve_assessment_policy", [t!.id])).toMatch(/four_eyes/);
    await db.rpc(approver, "approve_assessment_policy", [t!.id]);
  });

  it("company: the contract is not recorded as signed by whoever submitted it for approval", async () => {
    const org = await organization("status, enterprise_status", "null, 'negotiation'");
    await db.rpc(manager, "set_enterprise_status", [org, "institutional_approval", null]);
    expect(await db.rpcError(manager, "set_enterprise_status", [org, "contract_signed", null])).toMatch(/four_eyes/);
    await db.rpc(approver, "set_enterprise_status", [org, "contract_signed", null]);
  });

  it("partnership: not recorded as signed by whoever submitted it for validation", async () => {
    const org = await organization("status", "'negotiation'");
    await db.rpc(partner, "set_partner_status", [org, "institutional_validation", null]);
    expect(await db.rpcError(partner, "set_partner_status", [org, "agreement_signed", null])).toMatch(/four_eyes/);
    await db.rpc(approver, "set_partner_status", [org, "agreement_signed", null]);
  });

  it("agreement: not approved by the manager who wrote and submitted it", async () => {
    const org = await organization("status", "'negotiation'");
    const a = await db.rpc<string>(partner, "save_partnership_agreement", [
      null,
      org,
      JSON.stringify({ title: "Convention", intervention_field: slug, objectives: "Soutien scolaire en mathématiques.", start_on: "2026-11-01", end_on: "2027-06-30", renewal_notice_days: "60" }),
    ]);
    await db.rpc(partner, "set_agreement_status", [a, "internal_review", "{}"]);
    expect(await db.rpcError(partner, "set_agreement_status", [a, "approved", "{}"])).toMatch(/four_eyes/);
    await db.rpc(approver, "set_agreement_status", [a, "approved", "{}"]);
  });
});
