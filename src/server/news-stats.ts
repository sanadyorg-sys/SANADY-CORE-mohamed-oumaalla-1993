import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/server/rate-limit";

/**
 * Adds one view or click to an article's daily totals. The same address is
 * counted once per article (and per link) every 30 minutes, so reloading a
 * page does not inflate the figures. The address is only hashed into the
 * rate-limit key, never stored with the article.
 */
export async function recordNewsEvent(slug: string, kind: "view" | "course" | "event", detail = "") {
  try {
    const ip = createHash("sha256").update(await clientIp()).digest("hex").slice(0, 32);
    if (!(await rateLimit(`news:${kind}:${slug}:${detail}:${ip}`, 1, 1800))) return;
    const { error } = await createAdminClient().rpc("record_news_event", { p_slug: slug, p_kind: kind });
    if (error) console.error("[news] stats", error.message);
  } catch (e) {
    console.error("[news] stats", e);
  }
}
