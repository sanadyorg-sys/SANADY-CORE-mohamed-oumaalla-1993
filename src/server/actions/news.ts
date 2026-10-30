"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, messageFor } from "@/lib/errors";
import { NEWS_BUCKET, SLUG_PATTERN, casablancaToIso, slugify } from "@/lib/news";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { checkboxSchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireStaff } from "@/server/auth";
import { flushNotifications } from "@/server/notifications";

/** Editorial team: administrators publish; training managers and partnership staff write drafts. */
const EDITORS = ["admin", "manager", "partners"] as const;

function revalidateNews(id?: string, slug?: string) {
  revalidatePath("/actualites");
  revalidatePath("/");
  revalidatePath("/admin/actualites");
  if (id) revalidatePath(`/admin/actualites/${id}`);
  if (slug) revalidatePath(`/actualites/${slug}`);
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => v || null);

const localDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || casablancaToIso(v) !== null, "Date ou heure invalide.")
  .transform((v) => casablancaToIso(v));

/** A free slug: the wanted one, or the same with -2, -3… */
async function freeSlug(supabase: Awaited<ReturnType<typeof createClient>>, wanted: string, exceptId?: string) {
  const { data } = await supabase.from("news_articles").select("id, slug").like("slug", `${wanted}%`).limit(200);
  const taken = new Set(((data ?? []) as Array<{ id: string; slug: string }>).filter((r) => r.id !== exceptId).map((r) => r.slug));
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; n < 500; n++) if (!taken.has(`${wanted}-${n}`)) return `${wanted}-${n}`;
  return `${wanted}-${Date.now()}`;
}

/* ─── Create / update ───────────────────────────────────────────────────── */

export async function saveNewsArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireStaff([...EDITORS]);
  const parsed = parseInput(
    z.object({
      id: z.union([uuidSchema, z.literal("")]).optional(),
      title: z.string().trim().min(3, "Le titre doit comporter au moins 3 caractères.").max(200, "200 caractères maximum."),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .max(120, "120 caractères maximum.")
        .refine((v) => v === "" || (v.length >= 3 && SLUG_PATTERN.test(v)), "Lettres minuscules, chiffres et tirets uniquement (ex. : rentree-2026)."),
      subtitle: optional(300),
      excerpt: z.string().trim().max(500, "500 caractères maximum."),
      body: z.string().max(100000, "Le texte est trop long (100 000 caractères maximum)."),
      category_id: z.union([uuidSchema, z.literal("")]),
      author_label: z.string().trim().min(2, "Indiquez l’auteur ou l’organisme.").max(120),
      cover_alt: z.string().trim().max(250, "250 caractères maximum."),
      visibility: z.enum(["public", "members", "institutions"], "Choisissez un public."),
      featured: checkboxSchema,
      notify_email: checkboxSchema,
      event_starts_at: localDateTime,
      event_ends_at: localDateTime,
      event_location: optional(200),
      event_online: checkboxSchema,
      event_url: z
        .string()
        .trim()
        .max(1000)
        .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Le lien doit commencer par https://")
        .transform((v) => v || null),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const hasEventDetails = d.event_ends_at || d.event_location || d.event_url || d.event_online;
  if (hasEventDetails && !d.event_starts_at) {
    return { ok: false, fieldErrors: { event_starts_at: "Indiquez la date de début de l’événement." } };
  }
  if (d.event_starts_at && d.event_ends_at && d.event_ends_at < d.event_starts_at) {
    return { ok: false, fieldErrors: { event_ends_at: "La fin doit être après le début." } };
  }
  const institutionIds = [...new Set(formData.getAll("institution_ids").map(String))].filter((v) => uuidSchema.safeParse(v).success);
  const courseIds = [...new Set(formData.getAll("course_ids").map(String))].filter((v) => uuidSchema.safeParse(v).success).slice(0, 6);
  if (d.visibility === "institutions" && institutionIds.length === 0) {
    return { ok: false, fieldErrors: { visibility: "Choisissez au moins un établissement." } };
  }

  const supabase = await createClient();
  const slug = await freeSlug(supabase, d.slug || slugify(d.title), d.id || undefined);
  const values = {
    slug,
    title: d.title,
    subtitle: d.subtitle,
    excerpt: d.excerpt,
    body: d.body,
    category_id: d.category_id || null,
    author_label: d.author_label,
    cover_alt: d.cover_alt,
    visibility: d.visibility,
    featured: d.featured,
    notify_email: d.notify_email,
    event_starts_at: d.event_starts_at,
    event_ends_at: d.event_starts_at ? d.event_ends_at : null,
    event_location: d.event_starts_at ? d.event_location : null,
    event_online: d.event_starts_at ? d.event_online : false,
    event_url: d.event_starts_at ? d.event_url : null,
  };

  let id = d.id || "";
  let previousSlug: string | undefined;
  if (id) {
    const { data: before } = await supabase.from("news_articles").select("slug").eq("id", id).maybeSingle();
    if (!before) return { ok: false, message: messageFor("not_found") };
    previousSlug = (before as { slug: string }).slug;
    // Audience first: publishing rules check it when the article is already published.
    const linked = await syncLinks(supabase, id, institutionIds, courseIds);
    if (!linked.ok) return linked;
    const { error } = await supabase.from("news_articles").update(values).eq("id", id);
    if (error) return { ok: false, message: errorMessage(error) };
  } else {
    const { data, error } = await supabase.from("news_articles").insert({ ...values, status: "draft", created_by: viewer.id }).select("id").single();
    if (error) return { ok: false, message: errorMessage(error) };
    id = (data as { id: string }).id;
    const linked = await syncLinks(supabase, id, institutionIds, courseIds);
    if (!linked.ok) return linked;
  }

  revalidateNews(id, slug);
  if (previousSlug && previousSlug !== slug) revalidatePath(`/actualites/${previousSlug}`);
  if (!d.id) redirect(`/admin/actualites/${id}?cree=1`);
  return {
    ok: true,
    message: slug !== (d.slug || slug) ? `Article enregistré. L’adresse « ${d.slug} » était prise : « ${slug} » a été utilisée.` : "Article enregistré.",
    data: { slug },
  };
}

async function syncLinks(supabase: Awaited<ReturnType<typeof createClient>>, id: string, institutionIds: string[], courseIds: string[]): Promise<ActionState> {
  const [{ data: inst }, { data: courses }] = await Promise.all([
    supabase.from("news_article_institutions").select("institution_id").eq("article_id", id),
    supabase.from("news_article_courses").select("course_id, position").eq("article_id", id),
  ]);
  const currentInst = new Set(((inst ?? []) as Array<{ institution_id: string }>).map((r) => r.institution_id));
  const addInst = institutionIds.filter((i) => !currentInst.has(i));
  const removeInst = [...currentInst].filter((i) => !institutionIds.includes(i));
  const currentCourses = ((courses ?? []) as Array<{ course_id: string; position: number }>).sort((a, b) => a.position - b.position).map((r) => r.course_id);
  const coursesChanged = currentCourses.join() !== courseIds.join();

  if (addInst.length) {
    const { error } = await supabase.from("news_article_institutions").insert(addInst.map((institution_id) => ({ article_id: id, institution_id })));
    if (error) return { ok: false, message: errorMessage(error) };
  }
  if (removeInst.length) {
    const { error } = await supabase.from("news_article_institutions").delete().eq("article_id", id).in("institution_id", removeInst);
    if (error) return { ok: false, message: errorMessage(error) };
  }
  if (coursesChanged) {
    const { error: delError } = await supabase.from("news_article_courses").delete().eq("article_id", id);
    if (delError) return { ok: false, message: errorMessage(delError) };
    if (courseIds.length) {
      const { error } = await supabase.from("news_article_courses").insert(courseIds.map((course_id, position) => ({ article_id: id, course_id, position })));
      if (error) return { ok: false, message: errorMessage(error) };
    }
  }
  return { ok: true };
}

/* ─── Publication (administrators) ──────────────────────────────────────── */

export type NewsTransition = "publish" | "schedule" | "unpublish" | "archive" | "restore";

export async function setNewsStatus(id: string, transition: NewsTransition, scheduledAt?: string): Promise<ActionState> {
  await requireStaff(["admin"]);
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { data: before } = await supabase.from("news_articles").select("slug, status, published_at, notify_email, notified_at").eq("id", id).maybeSingle();
  const current = before as { slug: string; status: string; published_at: string | null; notify_email: boolean; notified_at: string | null } | null;
  if (!current) return { ok: false, message: messageFor("not_found") };

  const now = new Date();
  let update: Record<string, unknown>;
  let message: string;
  switch (transition) {
    case "publish": {
      // A first publication (or a scheduled one brought forward) is dated now; a republication keeps its date.
      const keepDate = current.published_at && new Date(current.published_at) <= now;
      update = { status: "published", published_at: keepDate ? current.published_at : now.toISOString() };
      message = "Article publié.";
      break;
    }
    case "schedule": {
      const at = casablancaToIso(scheduledAt);
      if (!at || new Date(at) <= new Date(now.getTime() + 60_000)) {
        return { ok: false, fieldErrors: { scheduled_at: "Choisissez une date et une heure à venir." } };
      }
      update = { status: "published", published_at: at };
      message = "Publication programmée.";
      break;
    }
    case "unpublish":
      update = { status: "draft" };
      message = "Article retiré : il est revenu en brouillon.";
      break;
    case "archive":
      update = { status: "archived" };
      message = "Article archivé : il n’est plus visible.";
      break;
    case "restore":
      update = { status: "draft" };
      message = "Article restauré en brouillon.";
      break;
  }
  const { error } = await supabase.from("news_articles").update(update).eq("id", id);
  if (error) return { ok: false, message: errorMessage(error) };

  // E-mail to the audience once the article is visible (scheduled ones: daily job).
  if (transition === "publish" && current.notify_email && !current.notified_at) {
    const { data: queued, error: queueError } = await supabase.rpc("queue_news_emails", { p_article: id });
    if (queueError) console.error("[news] queue e-mails", queueError.message);
    else if (Number(queued) > 0) {
      message += ` ${Number(queued)} e-mail${Number(queued) > 1 ? "s" : ""} en cours d’envoi.`;
      after(() => sendQueuedEmails());
    }
  }
  revalidateNews(id, current.slug);
  return { ok: true, message };
}

/** Sends the outbox in batches after the response, for up to ~50 seconds. */
async function sendQueuedEmails() {
  const started = Date.now();
  try {
    while (Date.now() - started < 50_000) {
      const r = await flushNotifications(50);
      if ("waiting" in r || r.sent + r.failed === 0) break;
    }
  } catch (e) {
    console.error("[news] e-mails", e);
  }
}

/* ─── Cover image ───────────────────────────────────────────────────────── */

export async function setNewsCover(id: string, path: string | null): Promise<ActionState> {
  await requireStaff([...EDITORS]);
  if (!uuidSchema.safeParse(id).success || (path && !path.startsWith(`${id}/`))) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { data: before } = await supabase.from("news_articles").select("cover_path, slug").eq("id", id).maybeSingle();
  const { data: updated, error } = await supabase.from("news_articles").update({ cover_path: path }).eq("id", id).select("id");
  if (error || !updated?.length) {
    if (path) await supabase.storage.from(NEWS_BUCKET).remove([path]);
    return { ok: false, message: error ? errorMessage(error) : messageFor("forbidden") };
  }
  const previous = (before as { cover_path: string | null } | null)?.cover_path;
  if (previous && previous !== path) await supabase.storage.from(NEWS_BUCKET).remove([previous]);
  revalidateNews(id, (before as { slug: string } | null)?.slug);
  return { ok: true, message: path ? "Image de couverture enregistrée." : "Image de couverture retirée." };
}

/* ─── Deletion (administrators; drafts that were never published) ──────── */

export async function deleteNewsArticle(id: string): Promise<ActionState> {
  await requireStaff(["admin"]);
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { data: row } = await supabase.from("news_articles").select("status, published_at").eq("id", id).maybeSingle();
  const article = row as { status: string; published_at: string | null } | null;
  if (!article) return { ok: false, message: messageFor("not_found") };
  if (article.status !== "draft" || article.published_at) {
    return { ok: false, message: "Un article déjà publié ne se supprime pas : archivez-le pour le retirer." };
  }
  const { data: files } = await supabase.storage.from(NEWS_BUCKET).list(id, { limit: 1000 });
  const { error } = await supabase.from("news_articles").delete().eq("id", id);
  if (error) return { ok: false, message: errorMessage(error) };
  if (files?.length) await supabase.storage.from(NEWS_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
  revalidateNews();
  redirect("/admin/actualites?supprime=1");
}

/* ─── Categories (administrators) ───────────────────────────────────────── */

export async function saveNewsCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["admin"]);
  const parsed = parseInput(
    z.object({
      id: z.union([uuidSchema, z.literal("")]).optional(),
      name: z.string().trim().min(2, "2 caractères au moins.").max(80, "80 caractères maximum."),
      description: z.string().trim().max(300, "300 caractères maximum."),
    }),
    formData,
  );
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  const d = parsed.data;
  const supabase = await createClient();
  if (d.id) {
    // The address (slug) of an existing category is kept: links to it stay valid.
    const { error } = await supabase.from("news_categories").update({ name: d.name, description: d.description }).eq("id", d.id);
    if (error) return { ok: false, message: errorMessage(error) };
  } else {
    const { data: last } = await supabase.from("news_categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("news_categories").insert({
      name: d.name,
      description: d.description,
      slug: slugify(d.name, 80),
      position: ((last as { position: number } | null)?.position ?? 0) + 1,
    });
    if (error) return { ok: false, message: errorMessage(error) };
  }
  revalidatePath("/admin/actualites/categories");
  revalidatePath("/actualites");
  return { ok: true, message: d.id ? "Catégorie modifiée." : "Catégorie ajoutée." };
}

export async function moveNewsCategory(id: string, direction: "up" | "down"): Promise<ActionState> {
  await requireStaff(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("news_categories").select("id, position").order("position").order("name");
  const list = (data ?? []) as Array<{ id: string; position: number }>;
  const index = list.findIndex((c) => c.id === id);
  const other = list[direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !other) return { ok: true };
  const order = list.map((c) => c.id);
  [order[index], order[order.indexOf(other.id)]] = [other.id, id];
  for (const [position, cid] of order.entries()) {
    const { error } = await supabase.from("news_categories").update({ position: position + 1 }).eq("id", cid);
    if (error) return { ok: false, message: errorMessage(error) };
  }
  revalidatePath("/admin/actualites/categories");
  revalidatePath("/actualites");
  return { ok: true };
}

export async function deleteNewsCategory(id: string): Promise<ActionState> {
  await requireStaff(["admin"]);
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: messageFor("not_found") };
  const supabase = await createClient();
  const { count } = await supabase.from("news_articles").select("id", { count: "exact", head: true }).eq("category_id", id).eq("status", "published");
  if (count) {
    return {
      ok: false,
      message: `${count} article${count > 1 ? "s publiés utilisent" : " publié utilise"} cette catégorie : choisissez-leur une autre catégorie avant de la supprimer.`,
    };
  }
  const { error } = await supabase.from("news_categories").delete().eq("id", id);
  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/admin/actualites/categories");
  revalidatePath("/actualites");
  return { ok: true, message: "Catégorie supprimée. Les brouillons qui l’utilisaient sont désormais sans catégorie." };
}
