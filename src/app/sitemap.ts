import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/** Rebuilt every hour: new articles appear without a deployment. */
export const revalidate = 3600;

/**
 * Public pages, public catalog courses and public news. Read with an
 * anonymous client (never the visitor's session), so restricted articles
 * and courses can never appear here.
 * Note: the site is still « noindex » (root layout) until launch.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.appUrl;
  const pages = ["", "/formations", "/programmes", "/ressources", "/actualites", "/a-propos", "/verifier", "/aide", "/demande-acces", "/confidentialite"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
  }));
  try {
    const anon = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const [catalog, news] = await Promise.all([
      anon.rpc("public_catalog"),
      anon.rpc("news_feed", { p_page: 1, p_page_size: 48 }).then(async (first) => {
        const rows = (first.data ?? []) as Array<{ slug: string; published_at: string; total_count: number }>;
        const total = rows.length ? Number(rows[0]!.total_count) : 0;
        const pagesCount = Math.min(20, Math.ceil(total / 48));
        for (let p = 2; p <= pagesCount; p++) {
          const { data } = await anon.rpc("news_feed", { p_page: p, p_page_size: 48 });
          rows.push(...((data ?? []) as typeof rows));
        }
        return rows;
      }),
    ]);
    const courses = ((catalog.data as { courses?: Array<{ id: string }> } | null)?.courses ?? []).map((c) => ({
      url: `${base}/formations/${c.id}`,
      changeFrequency: "monthly" as const,
    }));
    const articles = news.map((a) => ({ url: `${base}/actualites/${a.slug}`, lastModified: new Date(a.published_at), changeFrequency: "monthly" as const }));
    return [...pages, ...courses, ...articles];
  } catch (e) {
    console.error("[sitemap]", e);
    return pages;
  }
}
