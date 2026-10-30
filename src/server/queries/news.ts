import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { foldAccents } from "@/server/queries/library";
import { NEWS_PAGE_SIZE, type NewsArticlePage, type NewsArticleRow, type NewsCard, type NewsCategory, type NewsStatus } from "@/lib/news";

/* ─── Public reading (anonymous visitors included) ─────────────────────── */
// Both go through security-definer functions that apply the audience rules
// (public / members / institutions) and hide drafts and scheduled articles.

export interface NewsFeedFilters {
  q?: string;
  category?: string;
  page?: number;
  sort?: "recent" | "relevance";
  featured?: boolean;
  exclude?: string;
  pageSize?: number;
}

export async function getNewsFeed(filters: NewsFeedFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const { data, error } = await supabase.rpc("news_feed", {
    p_query: filters.q || null,
    p_category: filters.category || null,
    p_page: page,
    p_page_size: filters.pageSize ?? NEWS_PAGE_SIZE,
    p_sort: filters.sort ?? "recent",
    p_featured: filters.featured ?? null,
    p_exclude: filters.exclude ?? null,
  });
  if (error) {
    console.error("[news] feed", error.message);
    return { items: [] as NewsCard[], total: 0, page, failed: true };
  }
  const rows = (data ?? []) as Array<NewsCard & { total_count: number | string }>;
  return { items: rows as NewsCard[], total: rows.length ? Number(rows[0]!.total_count) : 0, page, failed: false };
}

/** Article for its page (null when missing or not readable by this person). */
export const getNewsArticle = cache(async (slug: string, preview = false) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("news_article", { p_slug: slug, p_preview: preview });
  if (error) console.error("[news] article", error.message);
  return (data ?? null) as NewsArticlePage | null;
});

export const getNewsCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_news_categories");
  if (error) console.error("[news] categories", error.message);
  return (data ?? []) as NewsCategory[];
});

/* ─── Editorial team (RLS: editors only) ───────────────────────────────── */

export const ADMIN_NEWS_PAGE_SIZE = 25;

export interface AdminNewsFilters {
  q?: string;
  status?: NewsStatus | "scheduled";
  category?: string;
  page?: number;
}

export interface AdminNewsItem {
  id: string;
  slug: string;
  title: string;
  status: NewsStatus;
  visibility: NewsArticleRow["visibility"];
  published_at: string | null;
  updated_at: string;
  featured: boolean;
  notify_email: boolean;
  notified_at: string | null;
  category: { name: string } | null;
  author: { first_name: string; last_name: string } | null;
}

export async function listAdminNews(filters: AdminNewsFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  let query = supabase
    .from("news_articles")
    .select(
      "id, slug, title, status, visibility, published_at, updated_at, featured, notify_email, notified_at, category:news_categories(name), author:profiles!news_articles_created_by_fkey(first_name, last_name)",
      { count: "exact" },
    );
  const now = new Date().toISOString();
  if (filters.status === "scheduled") query = query.eq("status", "published").gt("published_at", now);
  else if (filters.status === "published") query = query.eq("status", "published").lte("published_at", now);
  else if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.q) query = query.textSearch("search", foldAccents(filters.q), { config: "french", type: "websearch" });
  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .range((page - 1) * ADMIN_NEWS_PAGE_SIZE, page * ADMIN_NEWS_PAGE_SIZE - 1);
  if (error) console.error("[news] admin list", error.message);
  return { items: (data ?? []) as unknown as AdminNewsItem[], total: count ?? 0, page };
}

export interface AdminNewsArticle extends NewsArticleRow {
  institution_ids: string[];
  course_ids: string[];
}

export async function getAdminNewsArticle(id: string) {
  const supabase = await createClient();
  const [{ data: article }, { data: institutions }, { data: courses }] = await Promise.all([
    supabase.from("news_articles").select("*").eq("id", id).maybeSingle(),
    supabase.from("news_article_institutions").select("institution_id").eq("article_id", id),
    supabase.from("news_article_courses").select("course_id, position").eq("article_id", id).order("position"),
  ]);
  if (!article) return null;
  return {
    ...(article as NewsArticleRow),
    institution_ids: ((institutions ?? []) as Array<{ institution_id: string }>).map((r) => r.institution_id),
    course_ids: ((courses ?? []) as Array<{ course_id: string }>).map((r) => r.course_id),
  } as AdminNewsArticle;
}

/** Choices for the article form: schools (no company workspace) and published courses. */
export async function newsFormOptions() {
  const supabase = await createClient();
  const [{ data: institutions }, { data: courses }] = await Promise.all([
    supabase.from("institutions").select("id, name, city").neq("kind", "enterprise").eq("status", "active").order("name").limit(2000),
    supabase.from("courses").select("id, title, status, public_listing").in("status", ["published"]).order("title").limit(1000),
  ]);
  return {
    institutions: (institutions ?? []) as Array<{ id: string; name: string; city: string | null }>,
    courses: (courses ?? []) as Array<{ id: string; title: string; status: string; public_listing: boolean }>,
  };
}

/** Daily totals of the last `days` days, and all-time totals, for one article. */
export async function getNewsStats(id: string, days = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("news_daily_stats").select("day, views, course_clicks, event_clicks").eq("article_id", id).order("day");
  if (error) console.error("[news] stats", error.message);
  const rows = (data ?? []) as Array<{ day: string; views: number; course_clicks: number; event_clicks: number }>;
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const sum = (list: typeof rows) =>
    list.reduce((t, r) => ({ views: t.views + r.views, course: t.course + r.course_clicks, event: t.event + r.event_clicks }), { views: 0, course: 0, event: 0 });
  return { total: sum(rows), recent: sum(rows.filter((r) => r.day >= since)), daily: rows.filter((r) => r.day >= since) };
}

/** Total views per article, for the team's list. */
export async function getNewsViewTotals(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const supabase = await createClient();
  const { data } = await supabase.from("news_daily_stats").select("article_id, views").in("article_id", ids);
  const totals = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ article_id: string; views: number }>) totals.set(r.article_id, (totals.get(r.article_id) ?? 0) + r.views);
  return totals;
}
