import { NextResponse } from "next/server";
import { MOBILE_HEADERS } from "@/lib/supabase/bearer";

/**
 * GET /api/mobile/v1/config — version gate for the mobile clients.
 * Raise `minimumApiVersion` only when an incompatible backend change ships;
 * older binaries then ask the learner to update from the store.
 */
export function GET() {
  return NextResponse.json({ minimumApiVersion: 1 }, { headers: { ...MOBILE_HEADERS, "Cache-Control": "public, max-age=300" } });
}
