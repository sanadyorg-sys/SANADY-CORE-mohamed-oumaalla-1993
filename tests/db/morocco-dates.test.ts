/**
 * The database clock is UTC, the platform's day is Morocco's. Every function
 * that reads current_date must run in Morocco time, otherwise deadlines,
 * contract dates and reminders are a day late between midnight and 1 a.m.
 * A migration that creates or replaces such a function has to set it again
 * (see the last block of 20261113000200_follow_up_fixes.sql).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(async () => db?.close());

describe("« today » in database functions", () => {
  it("is read in Morocco time by every function that uses current_date", async () => {
    const rows = await db.sql<{ name: string; config: string[] | null }>(
      `select p.oid::regprocedure::text as name, p.proconfig as config
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prosrc ~* '\\mcurrent_date\\M'`);
    expect(rows.length).toBeGreaterThan(10);
    const missing = rows.filter((r) => !(r.config ?? []).some((c) => /^timezone=Africa\/Casablanca$/i.test(c))).map((r) => r.name);
    expect(missing).toEqual([]);
  });

  it("gives the Moroccan day inside such a function", async () => {
    await db.sql(`create function private.test_today() returns date language sql set timezone = 'Africa/Casablanca' as 'select current_date'`);
    const [r] = await db.sql<{ d: string }>(`select private.test_today()::text as d`);
    expect(r!.d).toBe(new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" }));
  });
});
