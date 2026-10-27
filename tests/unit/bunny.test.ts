import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BUNNY_VIDEO_ID, bunnyPlaybackUrls, bunnyUploadSignature, bunnyVideoState } from "@/lib/bunny";

const videoId = "3f1c2a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const sign = { hostname: "vz-test-123.b-cdn.net", tokenKey: "test-token-key", videoId, expires: 1_900_000_000 };

describe("Bunny Stream signing", () => {
  it("signs the whole video folder (directory token) for playlist, segments and thumbnail", () => {
    const { url, poster } = bunnyPlaybackUrls(sign);
    // Same inputs as Bunny's reference signer: signUrl(url, key, _, "", true, `/${videoId}/`, ..., expiresAt).
    const digest = createHmac("sha256", "test-token-key").update(`/${videoId}/1900000000token_path=/${videoId}/`).digest("base64");
    const expected = `HS256-${digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    const prefix = `https://vz-test-123.b-cdn.net/bcdn_token=${expected}&token_path=%2F${videoId}%2F&expires=1900000000`;
    expect(url).toBe(`${prefix}/${videoId}/playlist.m3u8`);
    expect(poster).toBe(`${prefix}/${videoId}/thumbnail.jpg`);
    expect(expected).toMatch(/^HS256-[A-Za-z0-9_-]{43}$/);
  });

  it("changes the token with the key, the video and the expiry", () => {
    const base = bunnyPlaybackUrls(sign).url;
    expect(bunnyPlaybackUrls({ ...sign, tokenKey: "other" }).url).not.toBe(base);
    expect(bunnyPlaybackUrls({ ...sign, expires: sign.expires + 1 }).url).not.toBe(base);
    expect(bunnyPlaybackUrls({ ...sign, videoId: videoId.replace("3f", "4f") }).url).not.toBe(base);
  });

  it("signs uploads as sha256(library + key + expiry + video), in hex", () => {
    const sig = bunnyUploadSignature("12345", "api-key", 1_900_000_000, videoId);
    expect(sig).toBe(createHash("sha256").update(`12345api-key1900000000${videoId}`).digest("hex"));
    expect(sig).not.toContain("api-key");
  });

  it("accepts only UUID video identifiers", () => {
    expect(BUNNY_VIDEO_ID.test(videoId)).toBe(true);
    expect(BUNNY_VIDEO_ID.test("../secret")).toBe(false);
    expect(BUNNY_VIDEO_ID.test(`${videoId}/../x`)).toBe(false);
  });

  it("maps encoding states", () => {
    expect([0, 1, 2, 3].map(bunnyVideoState)).toEqual(["processing", "processing", "processing", "processing"]);
    expect([4, 7, 8].map(bunnyVideoState)).toEqual(["ready", "ready", "ready"]);
    expect([5, 6].map(bunnyVideoState)).toEqual(["failed", "failed"]);
  });
});
