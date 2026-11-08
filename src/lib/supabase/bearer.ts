import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client for the MOBILE API: authenticated by the learner's access
 * token (Authorization: Bearer …) instead of cookies. RLS applies exactly as
 * for the website — the token is verified (getClaims) and every query runs
 * as that user. Never uses the service role.
 */
export async function createClientFromBearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+([A-Za-z0-9\-_.]+)$/i.exec(header)?.[1];
  if (!token) return null;

  const supabase = createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { supabase, userId, aal: data.claims.aal === "aal2" ? "aal2" : "aal1" } as const;
}

/** Marks responses as coming from the mobile API (lets the app tell "route missing" from "not found"). */
export const MOBILE_HEADERS = { "x-sanady-mobile": "1", "Cache-Control": "private, no-store" } as const;
