/**
 * Rate-limit counters can be checked without being consumed (sign-in counts
 * wrong passwords only), by the server alone.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(async () => db?.close());

const consume = (key: string) => db.rpc<boolean>(null, "consume_rate_limit", [key, 3, 900], "service_role");
const reached = (key: string) => db.rpc<boolean>(null, "rate_limit_reached", [key, 3, 900], "service_role");

describe("rate-limit check", () => {
  it("tells when a counter is full, without adding to it", async () => {
    const key = `login:fail:${uid()}@e.test`;
    expect(await reached(key)).toBe(false);
    await consume(key);
    await consume(key);
    for (let i = 0; i < 5; i++) expect(await reached(key)).toBe(false);
    await consume(key);
    expect(await reached(key)).toBe(true);
    expect(await reached(`${key}:other`)).toBe(false);
  });

  it("forgets a counter once its window has passed", async () => {
    const key = `login:fail:${uid()}@e.test`;
    for (let i = 0; i < 3; i++) await consume(key);
    await db.sql(`update private.rate_limits set window_started_at = now() - interval '16 minutes' where key = $1`, [key]);
    expect(await reached(key)).toBe(false);
  });

  it("is reserved to the server", async () => {
    const user = await db.createUser(`u.${uid()}@e.test`);
    expect(await db.rpcError(user, "rate_limit_reached", ["k", 3, 900])).toMatch(/permission denied/);
    expect(await db.rpcError(null, "rate_limit_reached", ["k", 3, 900], "anon")).toMatch(/permission denied/);
  });
});
