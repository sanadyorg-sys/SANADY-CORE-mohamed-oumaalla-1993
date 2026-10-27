import "server-only";
import { bunnyUploadSignature } from "@/lib/bunny";
import { serverEnv } from "@/lib/server-env";

/** Bunny Stream API (library-level key). Every call is server-side only. */
const API = "https://video.bunnycdn.com";

async function api(path: string, init: RequestInit = {}) {
  const bunny = serverEnv.bunny;
  if (!bunny) return null;
  try {
    const res = await fetch(`${API}/library/${encodeURIComponent(bunny.libraryId)}${path}`, {
      ...init,
      headers: { AccessKey: bunny.apiKey, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Creates an empty video in the library; the browser then uploads the file into it. */
export async function createBunnyVideo(title: string) {
  const video = await api("/videos", { method: "POST", body: JSON.stringify({ title: title.slice(0, 200) }) });
  return typeof video?.guid === "string" ? video.guid : null;
}

/** Encoding status and duration of a video, or null if it is not in the library. */
export async function bunnyVideo(videoId: string) {
  const video = await api(`/videos/${encodeURIComponent(videoId)}`);
  if (!video || typeof video.guid !== "string") return null;
  return {
    status: Number(video.status ?? 0),
    lengthSeconds: Number(video.length ?? 0) || null,
    encodeProgress: Number(video.encodeProgress ?? 0),
  };
}

export interface BunnyUploadTicket {
  videoId: string;
  libraryId: string;
  expires: number;
  signature: string;
}

/** Lets the browser upload one file into one video, for a limited time, without the API key. */
export function bunnyUploadTicket(videoId: string, ttlSeconds = 6 * 3600): BunnyUploadTicket | null {
  const bunny = serverEnv.bunny;
  if (!bunny) return null;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { videoId, libraryId: bunny.libraryId, expires, signature: bunnyUploadSignature(bunny.libraryId, bunny.apiKey, expires, videoId) };
}
