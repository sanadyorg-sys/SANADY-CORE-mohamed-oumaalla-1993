import { SLUG_PATTERN } from "@/lib/news";
import { recordNewsEvent } from "@/server/news-stats";

/** View beacon of an article page (see NewsViewBeacon). Always answers 204. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (slug.length <= 120 && SLUG_PATTERN.test(slug)) await recordNewsEvent(slug, "view");
  return new Response(null, { status: 204 });
}
