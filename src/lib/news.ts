import { publicEnv } from "./env";

/* ─── Actualités: shared types, labels and helpers ─────────────────────── */

export const NEWS_BUCKET = "news-images";
export const NEWS_PAGE_SIZE = 9;

export type NewsStatus = "draft" | "published" | "archived";
/** Status shown to the team: a published article dated in the future is « Programmé ». */
export type NewsDisplayStatus = NewsStatus | "scheduled";
export type NewsVisibility = "public" | "members" | "institutions";

export const NEWS_STATUS_LABELS: Record<NewsDisplayStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmé",
  published: "Publié",
  archived: "Archivé",
};

export const NEWS_STATUS_TONES: Record<NewsDisplayStatus, "neutral" | "accent" | "success" | "warning"> = {
  draft: "neutral",
  scheduled: "accent",
  published: "success",
  archived: "warning",
};

export const NEWS_VISIBILITY_LABELS: Record<NewsVisibility, string> = {
  public: "Public",
  members: "Membres connectés",
  institutions: "Établissements choisis",
};

export const NEWS_VISIBILITY_HINTS: Record<NewsVisibility, string> = {
  public: "Sur le site public, pour tout le monde.",
  members: "Pour toutes les personnes connectées à la plateforme (hors espaces entreprise).",
  institutions: "Uniquement pour les membres des établissements choisis ci-dessous.",
};

export interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  position: number;
}

export interface NewsArticleRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  body: string;
  cover_path: string | null;
  cover_alt: string;
  category_id: string | null;
  author_label: string;
  visibility: NewsVisibility;
  status: NewsStatus;
  published_at: string | null;
  featured: boolean;
  event_starts_at: string | null;
  event_ends_at: string | null;
  event_location: string | null;
  event_online: boolean;
  event_url: string | null;
  notify_email: boolean;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** One entry of public.news_feed. */
export interface NewsCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  cover_path: string | null;
  cover_alt: string;
  category_name: string | null;
  category_slug: string | null;
  author_label: string;
  visibility: NewsVisibility;
  published_at: string;
  featured: boolean;
  event_starts_at: string | null;
  event_location: string | null;
  event_online: boolean;
  reading_minutes: number;
}

/** Result of public.news_article. */
export interface NewsArticlePage {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  body: string;
  cover_path: string | null;
  cover_alt: string;
  author_label: string;
  visibility: NewsVisibility;
  status: NewsStatus;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  category: { name: string; slug: string } | null;
  event: { starts_at: string; ends_at: string | null; location: string | null; online: boolean; has_registration: boolean } | null;
  courses: Array<{ id: string; title: string; cover_path: string | null; public: boolean; accessible: boolean }>;
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  related: Array<{ slug: string; title: string; excerpt: string; cover_path: string | null; cover_alt: string; published_at: string }>;
}

export function newsDisplayStatus(a: { status: NewsStatus; published_at: string | null }, now = new Date()): NewsDisplayStatus {
  if (a.status === "published" && a.published_at && new Date(a.published_at) > now) return "scheduled";
  return a.status;
}

/** URL-safe slug: lower case, no accents, words joined by hyphens. */
export function slugify(value: string, max = 90) {
  const slug = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : slug ? `${slug}-actu` : "actualite";
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Public URL of an article image (news-images is a public bucket). */
export function newsImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${NEWS_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** « 12 mars 2026 », in Moroccan time. */
export function formatNewsDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Casablanca" }).format(new Date(value));
}

/** « jeudi 12 mars 2026 · 15 h 00 – 17 h 00 » for an event card. */
export function formatEventWhen(starts: string, ends?: string | null) {
  const tz = "Africa/Casablanca";
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date(starts));
  const time = (v: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(v)).replace(":", " h ");
  if (!ends) return `${day} · ${time(starts)}`;
  const dayKey = (v: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: tz }).format(new Date(v));
  const sameDay = dayKey(starts) === dayKey(ends);
  return sameDay
    ? `${day} · ${time(starts)} – ${time(ends)}`
    : `Du ${day} · ${time(starts)} au ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: tz }).format(new Date(ends))}`;
}

/* ─── Moroccan local time ⇄ ISO (forms use <input type="datetime-local">) ─ */
const TZ = "Africa/Casablanca";

function offsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute")) - Math.floor(at.getTime() / 60000) * 60000) / 60000;
}

/** « 2026-11-12T15:00 » typed in Moroccan time → ISO instant (null when empty or invalid). */
export function casablancaToIso(local: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local?.trim() ?? "");
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  const first = guess - offsetMinutes(new Date(guess)) * 60000;
  // Second pass: the offset at the real instant (around a time change).
  const at = guess - offsetMinutes(new Date(first)) * 60000;
  return new Date(at).toISOString();
}

/** ISO instant → « 2026-11-12T15:00 » in Moroccan time, for a datetime-local field. */
export function isoToCasablanca(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  const local = new Date(at.getTime() + offsetMinutes(at) * 60000);
  return local.toISOString().slice(0, 16);
}
