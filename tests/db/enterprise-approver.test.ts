/**
 * Approvers (partnership signatories) decide on enterprise proposals: they
 * read the proposals, their lines and history and the client's name, from a
 * two-factor session only, and nothing else of the enterprise team's work.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let manager: string;
let approver: string;
let coordinator: string;
let org: string;
let proposal: string;

beforeAll(async () => {
  db = await TestDb.create();
  const admin = await db.createAdmin();
  const other = await db.createAdmin();
  const staff = async (role: string) => {
    const id = await db.createUser(`${role}.${uid()}@sanady.test`);
    await db.rpc(admin, "set_platform_role", [id, role]);
    return id;
  };
  manager = await staff("enterprise_manager");
  approver = await staff("partnership_manager");
  coordinator = await staff("partnership_coordinator");
  await db.rpc(other, "set_partnership_signatory", [approver, true]);
  [{ id: org }] = (await db.sql<{ id: string }>(
    `insert into public.partner_organizations (name, org_type, status, enterprise_status) values ($1, 'entreprise', null, 'proposal') returning id`,
    [`Client ${uid()}`],
  )) as [{ id: string }];
  [{ id: proposal }] = (await db.sql<{ id: string }>(
    `insert into public.enterprise_proposals (reference, organization_id, title, service, currency, status) values ($1, $2, 'Formation sécurité', 'complete', 'MAD', 'draft') returning id`,
    [`PROP-A-${uid()}`, org],
  )) as [{ id: string }];
  await db.sql(
    `insert into public.enterprise_proposal_lines (proposal_id, category, label, quantity, unit, unit_price, position) values ($1, 'platform_access', 'Accès', 12, 'mois', 2000, 0)`,
    [proposal],
  );
  await db.rpc(manager, "set_proposal_status", [proposal, "internal_review", null]);
});
afterAll(async () => db?.close());

const read = (who: string, aal: "aal1" | "aal2" = "aal2") =>
  db.as(
    who,
    async (q) => ({
      proposals: (await q(`select id from public.enterprise_proposals where id = $1`, [proposal])).length,
      lines: (await q(`select id from public.enterprise_proposal_lines where proposal_id = $1`, [proposal])).length,
      history: (await q(`select id from public.enterprise_history where proposal_id = $1`, [proposal])).length,
      client: (await q(`select name from public.partner_organizations where id = $1`, [org])).length,
      orgHistory: (await q(`select id from public.enterprise_history where organization_id = $1`, [org])).length,
      requests: (await q(`select id from public.enterprise_requests`)).length,
    }),
    "authenticated",
    aal,
  );

describe("enterprise approvers", () => {
  it("read the proposal they approve, its lines, its history and the client", async () => {
    const r = await read(approver);
    expect(r).toMatchObject({ proposals: 1, lines: 1, client: 1 });
    expect(r.history).toBeGreaterThan(0);
  });

  it("do not read the enterprise team's other records", async () => {
    await db.rpc(manager, "add_enterprise_note", [org, null, null, "Note interne"]).catch(() => undefined);
    const r = await read(approver);
    expect(r.requests).toBe(0);
    expect(r.orgHistory).toBe(0);
  });

  it("read nothing without a two-factor session", async () => {
    expect(await read(approver, "aal1")).toMatchObject({ proposals: 0, lines: 0, history: 0, client: 0 });
  });

  it("are the only ones from the partnership team to read it", async () => {
    expect(await read(coordinator)).toMatchObject({ proposals: 0, lines: 0, history: 0, client: 0 });
  });

  it("approve it, which the manager cannot", async () => {
    expect(await db.rpcError(manager, "set_proposal_status", [proposal, "approved", null])).toMatch(/forbidden/);
    await db.rpc(approver, "set_proposal_status", [proposal, "approved", null]);
    const [p] = await db.sql<{ status: string; approved_by: string }>(`select status, approved_by from public.enterprise_proposals where id = $1`, [proposal]);
    expect(p).toEqual({ status: "approved", approved_by: approver });
  });
});
