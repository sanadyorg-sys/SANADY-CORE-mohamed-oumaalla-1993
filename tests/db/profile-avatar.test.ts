/**
 * Profile photo: uploaded by the account owner into their own folder of a
 * private bucket, recorded through set_profile_avatar, visible to the owner only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, uid } from "./harness";

let db: TestDb;
let owner: string;
let other: string;
let admin: string;

const upload = (who: string, path: string) => db.as(who, (q) => q(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [path]));

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.createAdmin();
  owner = await db.createUser(`owner.${uid()}@e.test`);
  other = await db.createUser(`other.${uid()}@e.test`);
});
afterAll(async () => db?.close());

describe("profile photo", () => {
  it("is uploaded by the owner into their own folder only, with a strict name", async () => {
    await upload(owner, `${owner}/avatar-1.jpg`);
    await expect(upload(other, `${owner}/avatar-2.jpg`)).rejects.toThrow(/row-level security/);
    await expect(upload(owner, `${owner}/photo.png`)).rejects.toThrow(/row-level security/);
    await expect(upload(owner, `${owner}/avatar-3.svg`)).rejects.toThrow(/row-level security/);
  });

  it("is recorded only for an uploaded file of the caller", async () => {
    expect(await db.rpcError(other, "set_profile_avatar", [`${owner}/avatar-1.jpg`])).toMatch(/invalid_input/);
    expect(await db.rpcError(owner, "set_profile_avatar", [`${owner}/avatar-9.jpg`])).toMatch(/invalid_input/);
    expect(await db.rpc<string | null>(owner, "set_profile_avatar", [`${owner}/avatar-1.jpg`])).toBeNull();
    const [p] = await db.sql<{ avatar_path: string; avatar_updated_at: string | null }>(`select avatar_path, avatar_updated_at from public.profiles where id = $1`, [owner]);
    expect(p!.avatar_path).toBe(`${owner}/avatar-1.jpg`);
    expect(p!.avatar_updated_at).not.toBeNull();
  });

  it("cannot be set by writing the column directly", async () => {
    await db.as(owner, (q) => q(`update public.profiles set avatar_path = $2 where id = $1`, [owner, `${other}/avatar-1.jpg`])).catch(() => undefined);
    const [p] = await db.sql<{ avatar_path: string }>(`select avatar_path from public.profiles where id = $1`, [owner]);
    expect(p!.avatar_path).toBe(`${owner}/avatar-1.jpg`);
  });

  it("is readable by its owner only (not other users, not administrators)", async () => {
    const read = (who: string) => db.as(who, (q) => q(`select name from storage.objects where bucket_id = 'avatars'`));
    expect(await read(owner)).toHaveLength(1);
    expect(await read(other)).toHaveLength(0);
    expect(await read(admin)).toHaveLength(0);
  });

  it("returns the previous path on replacement and removal, and the owner can delete files", async () => {
    await upload(owner, `${owner}/avatar-2.jpg`);
    expect(await db.rpc<string>(owner, "set_profile_avatar", [`${owner}/avatar-2.jpg`])).toBe(`${owner}/avatar-1.jpg`);
    await db.as(owner, (q) => q(`delete from storage.objects where bucket_id = 'avatars' and name = $1`, [`${owner}/avatar-1.jpg`]));
    await db.as(other, (q) => q(`delete from storage.objects where bucket_id = 'avatars' and name = $1`, [`${owner}/avatar-2.jpg`]));
    expect(await db.as(owner, (q) => q(`select name from storage.objects where bucket_id = 'avatars'`))).toHaveLength(1);
    expect(await db.rpc<string>(owner, "set_profile_avatar", [null])).toBe(`${owner}/avatar-2.jpg`);
  });

  it("refuses suspended accounts", async () => {
    await db.sql(`update public.profiles set status = 'suspended' where id = $1`, [other]);
    await expect(upload(other, `${other}/avatar-1.jpg`)).rejects.toThrow(/row-level security/);
  });
});
