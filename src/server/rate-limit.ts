import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Best-effort client IP. Vercel sets x-vercel-forwarded-for and x-real-ip
 * itself (a client cannot choose them); x-forwarded-for comes last because
 * elsewhere a client could send any value in it.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Fixed-window rate limit stored in PostgreSQL (shared by all server
 * instances). Returns true when the request is allowed.
 * Fails CLOSED for sensitive endpoints if the limiter is unreachable.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[rate-limit] unavailable", err);
    return false;
  }
}

/**
 * Whether a counter has reached its limit, without adding to it. Fails OPEN:
 * it only adds to the limits taken with rateLimit, which stay closed (and an
 * error here must never lock everyone out of sign-in).
 */
export async function rateLimitReached(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_reached", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[rate-limit] check unavailable", err);
    return false;
  }
}
