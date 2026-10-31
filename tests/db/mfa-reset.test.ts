/**
 * Two-factor reset: administrators only, from a two-factor session, never on
 * their own account, and always recorded in the activity log.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let admin: string;
let manager: string;
let teacher: string;

const logs = (user: string) => db.sql<{ actor_id: string; details: { factors: number } }>(`select actor_id, details from public.audit_logs where action = 'mfa_reset' and entity_id = $1`, [user]);

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  manager = await db.createUser(`resp.${uid()}@sanady.test`);
  await db.rpc(admin, "set_platform_role", [manager, "training_manager"]);
  teacher = await db.createUser(`prof.${uid()}@ecole.test`);
});
afterAll(async () => db?.close());

describe("authorize_mfa_reset", () => {
  it("lets an administrator reset someone else, and records it", async () => {
    await db.rpc(admin, "authorize_mfa_reset", [teacher, 1]);
    expect(await logs(teacher)).toEqual([expect.objectContaining({ actor_id: admin, details: { factors: 1 } })]);
  });

  it("refuses an administrator's own account", async () => {
    expect(await db.rpcError(admin, "authorize_mfa_reset", [admin, 1])).toMatch(/cannot_reset_own_mfa/);
  });

  it("refuses everyone else, and a password-only administrator session", async () => {
    expect(await db.rpcError(manager, "authorize_mfa_reset", [teacher, 1])).toMatch(/forbidden/);
    expect(await db.rpcError(teacher, "authorize_mfa_reset", [manager, 1])).toMatch(/forbidden/);
    expect(await db.rpcError(null, "authorize_mfa_reset", [teacher, 1], "anon")).toMatch(/permission denied/);
    await expect(db.as(admin, (q) => q(`select public.authorize_mfa_reset($1, 1)`, [teacher]), "authenticated", "aal1")).rejects.toThrow(/forbidden/);
  });

  it("refuses an unknown account", async () => {
    expect(await db.rpcError(admin, "authorize_mfa_reset", ["00000000-0000-4000-8000-000000000000", 0])).toMatch(/not_found/);
  });
});
