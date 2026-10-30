import { NextResponse } from "next/server";
import { SLUG_PATTERN } from "@/lib/news";
import { createClient } from "@/lib/supabase/server";
import { recordNewsEvent } from "@/server/news-stats";

/** Registration link of an article's event: counts the click, then opens the registration page. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug)) return NextResponse.redirect(new URL("/actualites", request.url));
  const supabase = await createClient();
  const { data } = await supabase.rpc("news_event_url", { p_slug: slug });
  const url = typeof data === "string" && /^https:\/\/[^\s]+$/.test(data) ? data : null;
  if (!url) return NextResponse.redirect(new URL(`/actualites/${slug}`, request.url));
  await recordNewsEvent(slug, "event");
  return NextResponse.redirect(url);
}
