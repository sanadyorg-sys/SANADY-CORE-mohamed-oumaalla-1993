import { createHash, createHmac } from "node:crypto";

/*
 * Bunny Stream signing, kept free of server-only imports so it can be unit
 * tested. Only server code calls it: the keys never reach the browser.
 */

/** Bunny video IDs are UUIDs. */
export const BUNNY_VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bunny CDN token authentication (HMAC-SHA256, "HS256-" tokens), directory
 * form: one token covers the video's whole folder, so the HLS playlist, the
 * renditions and segments it references (relative URLs) and the thumbnail are
 * all allowed until `expires`. Mirrors Bunny's reference signer
 * (github.com/BunnyWay/BunnyCDN.TokenAuthentication, nodejs/token.js).
 */
export function bunnyPlaybackUrls({
  hostname,
  tokenKey,
  videoId,
  expires,
}: {
  hostname: string;
  tokenKey: string;
  videoId: string;
  expires: number;
}) {
  const directory = `/${videoId}/`;
  // Signed message: signature path, expiry, (no IP), then the sorted parameters (here only token_path).
  const digest = createHmac("sha256", tokenKey).update(`${directory}${expires}token_path=${directory}`).digest("base64");
  const token = `HS256-${digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  const prefix = `https://${hostname}/bcdn_token=${token}&token_path=${encodeURIComponent(directory)}&expires=${expires}`;
  return {
    url: `${prefix}/${videoId}/playlist.m3u8`,
    poster: `${prefix}/${videoId}/thumbnail.jpg`,
  };
}

/** Signature of a direct (TUS) upload to one video of the library. */
export function bunnyUploadSignature(libraryId: string, apiKey: string, expires: number, videoId: string) {
  return createHash("sha256").update(`${libraryId}${apiKey}${expires}${videoId}`).digest("hex");
}

/** Bunny encoding states (video.status): 4 = finished; 7 and 8 (just-in-time encoding) also play. */
export function bunnyVideoState(status: number): "ready" | "processing" | "failed" {
  if (status === 4 || status === 7 || status === 8) return "ready";
  if (status === 5 || status === 6) return "failed";
  return "processing";
}
