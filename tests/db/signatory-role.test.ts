/**
 * The approver habilitation follows the role: it is revoked when the role
 * changes or is removed, and never works without a role that may approve.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let other: string;
let manager: string;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  other = await db.createAdmin();
  manager = await db.createUser(`ent.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [manager, "enterprise_manager"]);
});
afterAll(async () => db?.close());

async function approver(role = "partnership_manager") {
  const id = await db.createUser(`appr.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [id, role]);
  await db.rpc(other, "set_partnership_signatory", [id, true]);
  return id;
}

async function proposalUnderReview() {
  const [o] = await db.sql<{ id: string }>(`insert into public.partner_organizations (name, org_type, enterprise_status) values ($1, 'entreprise', 'proposal') returning id`, [`Org ${uid()}`]);
  const [p] = await db.sql<{ id: string }>(
    `insert into public.enterprise_proposals (reference, organization_id, title, service, currency, status) values ($1, $2, 'Formation', 'complete', 'MAD', 'draft') returning id`,
    [`PROP-R-${uid()}`, o!.id],
  );
  await db.sql(`insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit, unit_price, position) values ($1, 'platform_access', 'Accès', 1, 'mois', 100, 0)`, [p!.id]);
  await db.rpc(manager, "set_proposal_status", [p!.id, "internal_review", null]);
  return p!.id;
}

const active = async (user: string) =>
  (await db.sql(`select 1 from public.partnership_signatories where user_id = $1 and revoked_at is null`, [user])).length === 1;

describe("approver habilitation and role", () => {
  it("is revoked when the role is removed", async () => {
    const a = await approver();
    await db.rpc(admin, "set_platform_role", [a, null]);
    expect(await active(a)).toBe(false);
    expect(await db.rpcError(a, "set_proposal_status", [await proposalUnderReview(), "approved", null])).toMatch(/forbidden/);
  });

  it("is revoked when the role changes, until granted again", async () => {
    const a = await approver();
    await db.rpc(admin, "set_platform_role", [a, "enterprise_manager"]);
    expect(await active(a)).toBe(false);
    await db.rpc(other, "set_partnership_signatory", [a, true]);
    await db.rpc(a, "set_proposal_status", [await proposalUnderReview(), "approved", null]);
  });

  it("stays when the role is set again unchanged", async () => {
    const a = await approver();
    await db.rpc(admin, "set_platform_role", [a, "partnership_manager"]);
    expect(await active(a)).toBe(true);
  });

  it("never works without a role that may approve", async () => {
    const trainer = await db.createUser(`tr.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [trainer, "trainer"]);
    await db.sql(`insert into public.partnership_signatories (user_id, granted_by) values ($1, $2)`, [trainer, admin]);
    expect(await db.rpcError(trainer, "set_proposal_status", [await proposalUnderReview(), "approved", null])).toMatch(/forbidden/);
  });
});
