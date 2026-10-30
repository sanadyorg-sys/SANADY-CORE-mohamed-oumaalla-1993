"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  CalendarClock,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pencil,
  PlayCircle,
  Quote,
  Search,
  Trash2,
} from "lucide-react";
import { FileUploader } from "@/components/admin/file-uploader";
import { ActionButton } from "@/components/common/action-button";
import { NewsBody } from "@/components/news/news-body";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormActions, FormMessage, SubmitButton, useActionToast } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  NEWS_BUCKET,
  NEWS_VISIBILITY_HINTS,
  NEWS_VISIBILITY_LABELS,
  isoToCasablanca,
  newsImageUrl,
  slugify,
  type NewsCategory,
  type NewsVisibility,
} from "@/lib/news";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/types";
import { fileType, safeFileName, uploadToStorage } from "@/lib/upload";
import {
  deleteNewsCategory,
  moveNewsCategory,
  saveNewsArticle,
  saveNewsCategory,
  setNewsCover,
  setNewsStatus,
} from "@/server/actions/news";
import type { AdminNewsArticle } from "@/server/queries/news";

const IMAGE_TYPES = "image/jpeg, image/png, image/webp";
const IMAGE_MAX = 5 * 1024 * 1024;

/** Storage path of an image added to the body: « <article>/<time>-<name> ». */
function bodyImagePath(articleId: string, file: File) {
  return `${articleId}/${Date.now().toString(36)}-${safeFileName(file.name)}`;
}

/* ─── Article form ──────────────────────────────────────────────────────── */

export function NewsArticleForm({
  article,
  categories,
  institutions,
  courses,
  canPublish,
}: {
  article?: AdminNewsArticle;
  categories: NewsCategory[];
  institutions: Array<{ id: string; name: string; city: string | null }>;
  courses: Array<{ id: string; title: string; public_listing: boolean }>;
  canPublish: boolean;
}) {
  const [state, action] = useActionState(saveNewsArticle, INITIAL_ACTION_STATE);
  useActionToast(state);
  const e = state.fieldErrors ?? {};
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [visibility, setVisibility] = useState<NewsVisibility>(article?.visibility ?? "public");
  const [hasEvent, setHasEvent] = useState(Boolean(article?.event_starts_at));
  const locked = article ? article.status !== "draft" && !canPublish : false;

  return (
    <form action={action} className="space-y-8" noValidate>
      {!state.ok && state.message ? <FormMessage state={state} /> : null}
      {locked ? (
        <p className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-body text-warning-900">
          Cet article n’est plus un brouillon : seul un administrateur peut le modifier.
        </p>
      ) : null}
      <input type="hidden" name="id" value={article?.id ?? ""} />

      <Section title="Contenu" description="Le titre, l’introduction et le texte affichés sur la page de l’article.">
        <Field label="Titre" error={e.title}>
          <Input
            name="title"
            value={title}
            onChange={(ev) => {
              setTitle(ev.target.value);
              if (!slugTouched) setSlug(slugify(ev.target.value));
            }}
            required
            maxLength={200}
            placeholder="Ex. : Une nouvelle formation sur l’évaluation formative"
          />
        </Field>
        <Field label="Sous-titre" optional error={e.subtitle}>
          <Input name="subtitle" defaultValue={article?.subtitle ?? ""} maxLength={300} />
        </Field>
        <Field
          label="Introduction"
          hint={`Affichée sur les cartes et en tête d’article, utilisée par les moteurs de recherche. ${excerpt.length}/500`}
          error={e.excerpt}
        >
          <Textarea name="excerpt" value={excerpt} onChange={(ev) => setExcerpt(ev.target.value)} rows={3} maxLength={500} />
        </Field>
        <NewsEditor name="body" defaultValue={article?.body ?? ""} articleId={article?.id} error={e.body} />
      </Section>

      <Section title="Classement et public">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie" hint="Obligatoire pour publier." error={e.category_id}>
            <Select name="category_id" defaultValue={article?.category_id ?? ""}>
              <option value="">Choisir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Auteur ou organisme" error={e.author_label}>
            <Input name="author_label" defaultValue={article?.author_label ?? "Fondation Sanady"} maxLength={120} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-label font-medium text-ink-800">Public</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(NEWS_VISIBILITY_LABELS) as NewsVisibility[]).map((v) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors",
                  visibility === v ? "border-accent-500 bg-accent-50/60 ring-1 ring-accent-500/30" : "border-line hover:bg-ink-25",
                )}
              >
                <span className="flex items-center gap-2 text-body font-semibold text-ink-900">
                  <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="accent-accent-600" />
                  {NEWS_VISIBILITY_LABELS[v]}
                </span>
                <span className="text-caption text-ink-600">{NEWS_VISIBILITY_HINTS[v]}</span>
              </label>
            ))}
          </div>
          {e.visibility ? (
            <p className="mt-2 text-caption font-medium text-danger-600" role="alert">
              {e.visibility}
            </p>
          ) : null}
        </fieldset>
        {visibility === "institutions" ? (
          <PickList
            name="institution_ids"
            label="Établissements"
            empty="Aucun établissement disponible."
            options={institutions.map((i) => ({ id: i.id, label: i.name, hint: i.city ?? undefined }))}
            selected={article?.institution_ids ?? []}
          />
        ) : (
          (article?.institution_ids ?? []).map((id) => <input key={id} type="hidden" name="institution_ids" value={id} />)
        )}
      </Section>

      <Section title="Formations liées" description="Formations existantes mises en avant à la fin de l’article (6 au plus). Une formation retirée n’est plus affichée.">
        <PickList
          name="course_ids"
          label="Formations publiées"
          empty="Aucune formation publiée."
          max={6}
          options={courses.map((c) => ({ id: c.id, label: c.title, hint: c.public_listing ? "Catalogue public" : "Réservée aux inscrits" }))}
          selected={article?.course_ids ?? []}
        />
      </Section>

      <Section title="Événement" description="Webinaire, atelier ou conférence : la date et le lien d’inscription s’affichent dans une carte dédiée.">
        <Checkbox label="Cet article annonce un événement" checked={hasEvent} onChange={(ev) => setHasEvent(ev.currentTarget.checked)} />
        {hasEvent ? (
          <div className="grid gap-4 rounded-xl border border-line bg-ink-25 p-4 sm:grid-cols-2">
            <Field label="Début (heure du Maroc)" error={e.event_starts_at}>
              <Input type="datetime-local" name="event_starts_at" defaultValue={isoToCasablanca(article?.event_starts_at)} />
            </Field>
            <Field label="Fin" optional error={e.event_ends_at}>
              <Input type="datetime-local" name="event_ends_at" defaultValue={isoToCasablanca(article?.event_ends_at)} />
            </Field>
            <Field label="Lieu" optional hint="Ville, établissement ou plateforme." error={e.event_location}>
              <Input name="event_location" defaultValue={article?.event_location ?? ""} maxLength={200} />
            </Field>
            <Field label="Lien d’inscription" optional error={e.event_url}>
              <Input type="url" name="event_url" defaultValue={article?.event_url ?? ""} placeholder="https://" maxLength={1000} />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox name="event_online" label="Événement en ligne" defaultChecked={article?.event_online} />
            </div>
          </div>
        ) : (
          <input type="hidden" name="event_starts_at" value="" />
        )}
      </Section>

      <Section title="Adresse et options">
        <Field
          label="Adresse de la page"
          hint={
            <>
              /actualites/<strong>{slug || "…"}</strong> — générée depuis le titre. La modifier après publication casse les liens déjà partagés.
            </>
          }
          error={e.slug}
        >
          <Input
            name="slug"
            value={slug}
            onChange={(ev) => {
              setSlugTouched(true);
              setSlug(ev.target.value.toLowerCase());
            }}
            maxLength={120}
          />
        </Field>
        <Field label="Texte alternatif de l’image de couverture" optional hint="Décrit l’image pour les personnes qui ne la voient pas." error={e.cover_alt}>
          <Input name="cover_alt" defaultValue={article?.cover_alt ?? ""} maxLength={250} />
        </Field>
        <div className="space-y-3">
          <Checkbox name="featured" defaultChecked={article?.featured} label="Mettre « À la une »" description="L’article à la une le plus récent s’affiche en grand en haut de la page Actualités." />
          <Checkbox
            name="notify_email"
            defaultChecked={article?.notify_email}
            disabled={Boolean(article?.notified_at)}
            label="Prévenir le public par e-mail à la publication"
            description={
              article?.notified_at
                ? "Le message a déjà été envoyé pour cet article."
                : "Un seul message, aux membres des établissements concernés (ou de tous les établissements pour un article public ou réservé aux membres), sauf ceux qui ont désactivé les e-mails."
            }
          />
        </div>
      </Section>

      <FormActions>
        <SubmitButton disabled={locked}>{article ? "Enregistrer" : "Créer le brouillon"}</SubmitButton>
      </FormActions>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-section font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-label text-ink-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Searchable checkbox list (institutions, courses). */
function PickList({
  name,
  label,
  options,
  selected,
  empty,
  max,
}: {
  name: string;
  label: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  selected: string[];
  empty: string;
  max?: number;
}) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [filter, setFilter] = useState("");
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const shown = useMemo(() => options.filter((o) => !filter || fold(`${o.label} ${o.hint ?? ""}`).includes(fold(filter))), [options, filter]);
  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : max && list.length >= max ? list : [...list, id]));

  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="text-label font-medium text-ink-800">
          {label} <span className="tabular font-normal text-ink-500">· {chosen.length} choisi{chosen.length > 1 ? "s" : ""}{max ? ` / ${max}` : ""}</span>
        </p>
        {options.length > 6 ? (
          <label className="relative">
            <span className="sr-only">Filtrer</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              type="search"
              value={filter}
              onChange={(ev) => setFilter(ev.target.value)}
              placeholder="Filtrer…"
              className="h-8 w-48 rounded-md border border-line bg-surface pl-8 pr-2 text-label focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
            />
          </label>
        ) : null}
      </div>
      {chosen.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {options.length === 0 ? (
        <p className="px-3 py-4 text-label text-ink-500">{empty}</p>
      ) : (
        <ul className="max-h-60 divide-y divide-line overflow-y-auto">
          {shown.map((o) => {
            const on = chosen.includes(o.id);
            const full = Boolean(max && !on && chosen.length >= max);
            return (
              <li key={o.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-body hover:bg-ink-25", full && "cursor-not-allowed opacity-50")}>
                  <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(o.id)} className="size-4 accent-accent-600" />
                  <span className="min-w-0 flex-1 truncate text-ink-900">{o.label}</span>
                  {o.hint ? <span className="shrink-0 text-caption text-ink-500">{o.hint}</span> : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Body editor ───────────────────────────────────────────────────────── */

type Tool = { icon: typeof Bold; label: string; run: (sel: string) => { text: string; cursor?: number } ; block?: boolean };

const TOOLS: Tool[] = [
  { icon: Heading2, label: "Titre de section", block: true, run: (s) => ({ text: `## ${s || "Titre de section"}` }) },
  { icon: Heading3, label: "Sous-titre", block: true, run: (s) => ({ text: `### ${s || "Sous-titre"}` }) },
  { icon: Bold, label: "Gras", run: (s) => ({ text: `**${s || "texte en gras"}**` }) },
  { icon: Italic, label: "Italique", run: (s) => ({ text: `*${s || "texte en italique"}*` }) },
  { icon: Link2, label: "Lien", run: (s) => ({ text: `[${s || "texte du lien"}](https://)` }) },
  { icon: List, label: "Liste à puces", block: true, run: (s) => ({ text: (s || "Élément").split("\n").map((l) => `- ${l}`).join("\n") }) },
  { icon: ListOrdered, label: "Liste numérotée", block: true, run: (s) => ({ text: (s || "Étape").split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n") }) },
  { icon: Quote, label: "Citation", block: true, run: (s) => ({ text: (s || "Citation").split("\n").map((l) => `> ${l}`).join("\n") }) },
  { icon: Minus, label: "Séparateur", block: true, run: () => ({ text: "---" }) },
  { icon: PlayCircle, label: "Lien vers une vidéo YouTube ou Vimeo", block: true, run: (s) => ({ text: `@video(${s.startsWith("https://") ? s : "https://www.youtube.com/watch?v="})` }) },
];

export function NewsEditor({ name, defaultValue, articleId, error }: { name: string; defaultValue: string; articleId?: string; error?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState<number | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const insert = (tool: Pick<Tool, "run" | "block">) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const { text } = tool.run(value.slice(a, b));
    // Block marks start on their own paragraph.
    const before = value.slice(0, a);
    const prefix = tool.block && before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const suffix = tool.block ? "\n\n" : "";
    const next = before + prefix + text + suffix + value.slice(b);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const end = (before + prefix + text).length;
      el.setSelectionRange(end, end);
    });
  };

  const uploadImage = async (file: File) => {
    if (!articleId) return;
    if (!IMAGE_TYPES.split(", ").includes(fileType(file))) {
      toast({ tone: "danger", title: "Format non pris en charge : JPEG, PNG ou WebP." });
      return;
    }
    if (file.size > IMAGE_MAX) {
      toast({ tone: "danger", title: "Image trop lourde (5 Mo maximum)." });
      return;
    }
    const path = bodyImagePath(articleId, file);
    setUploading(0);
    try {
      await uploadToStorage({ bucket: NEWS_BUCKET, path, file, onProgress: setUploading }).promise;
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      insert({ block: true, run: () => ({ text: `![${alt}](${path} "Légende facultative")` }) });
      toast({ tone: "success", title: "Image ajoutée : vérifiez son texte alternatif (entre crochets)." });
    } catch (err) {
      toast({ tone: "danger", title: err instanceof Error ? err.message : "Le téléversement a échoué." });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span id={`${name}-label`} className="text-label font-medium text-ink-800">
          Texte de l’article
        </span>
        <div role="tablist" aria-label="Mode d’édition" className="flex rounded-lg bg-ink-100 p-0.5 text-label">
          {(
            [
              ["write", "Rédiger", Pencil],
              ["preview", "Aperçu", Eye],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium", tab === key ? "bg-surface text-ink-900 shadow-xs" : "text-ink-600 hover:text-ink-900")}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn("overflow-hidden rounded-xl border bg-surface", error ? "border-danger-500" : "border-line-strong")}>
        {tab === "write" ? (
          <>
            <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-ink-25 px-1.5 py-1">
              {TOOLS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => insert(t)}
                  className="flex size-8 items-center justify-center rounded-md text-ink-600 hover:bg-surface hover:text-ink-900"
                >
                  <t.icon className="size-4" aria-hidden />
                </button>
              ))}
              <span aria-hidden className="mx-1 h-5 w-px bg-line" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={!articleId || uploading !== null}
                title={articleId ? "Ajouter une image" : "Enregistrez d’abord le brouillon pour ajouter des images"}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-label font-medium text-ink-700 hover:bg-surface hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus className="size-4" aria-hidden />
                {uploading !== null ? `Envoi… ${Math.round(uploading * 100)} %` : "Image"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_TYPES}
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = "";
                  if (f) void uploadImage(f);
                }}
              />
            </div>
            <textarea
              ref={area}
              name={name}
              value={value}
              onChange={(ev) => setValue(ev.target.value)}
              aria-labelledby={`${name}-label`}
              aria-describedby={`${name}-help`}
              aria-invalid={Boolean(error) || undefined}
              rows={18}
              maxLength={100000}
              placeholder={"Rédigez l’article ici.\n\nSéparez les paragraphes par une ligne vide. Utilisez la barre d’outils pour les titres, listes, liens et images."}
              className="block w-full resize-y bg-surface px-4 py-3 font-mono text-[0.875rem] leading-relaxed text-ink-900 placeholder:font-sans placeholder:text-ink-400 focus:outline-none"
            />
          </>
        ) : (
          <>
            <input type="hidden" name={name} value={value} />
            <div className="min-h-[24rem] px-5 py-5">
              {value.trim() ? <NewsBody source={value} /> : <p className="text-body text-ink-500">Rien à afficher pour l’instant.</p>}
            </div>
          </>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-caption font-medium text-danger-600" role="alert">
          {error}
        </p>
      ) : null}
      <details id={`${name}-help`} className="mt-2 text-caption text-ink-500">
        <summary className="cursor-pointer font-medium text-ink-600 hover:text-ink-900">Aide à la mise en forme</summary>
        <ul className="mt-2 grid gap-1 rounded-lg bg-ink-25 p-3 font-mono sm:grid-cols-2">
          <li>## Titre de section</li>
          <li>### Sous-titre</li>
          <li>**gras** · *italique*</li>
          <li>[texte](https://exemple.ma)</li>
          <li>- liste à puces</li>
          <li>1. liste numérotée</li>
          <li>&gt; citation</li>
          <li>--- séparateur</li>
          <li>![description](image) — bouton Image</li>
          <li>@video(https://youtube.com/…)</li>
        </ul>
        <p className="mt-2">Aucun code HTML n’est interprété : tout ce qui est saisi s’affiche comme du texte.</p>
      </details>
    </div>
  );
}

/* ─── Publication panel (administrators) ───────────────────────────────── */

export function NewsPublishPanel({ article, canPublish }: { article: AdminNewsArticle; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [when, setWhen] = useState(isoToCasablanca(article.published_at && new Date(article.published_at) > new Date() ? article.published_at : null));
  const [error, setError] = useState<string | null>(null);

  if (!canPublish) {
    return (
      <p className="text-body text-ink-600">
        {article.status === "draft"
          ? "Quand le brouillon est prêt, un administrateur SANADY le relit et le publie."
          : "Seul un administrateur peut modifier un article publié, programmé ou archivé."}
      </p>
    );
  }

  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        toast({ tone: "success", title: res.message ?? "Opération effectuée." });
        setScheduleOpen(false);
        router.refresh();
      } else {
        setError(res.fieldErrors?.scheduled_at ?? res.message ?? "L’opération a échoué.");
      }
    });
  const live = article.status === "published";

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-label text-danger-700">
          {error}
        </p>
      ) : null}
      {article.status !== "archived" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" disabled={pending} onClick={() => run(() => setNewsStatus(article.id, "publish"))}>
            {live && article.published_at && new Date(article.published_at) > new Date() ? "Publier maintenant" : live ? "Republier" : "Publier maintenant"}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setScheduleOpen((v) => !v)} aria-expanded={scheduleOpen}>
            <CalendarClock aria-hidden /> Programmer
          </Button>
        </div>
      ) : null}
      {scheduleOpen ? (
        <div className="space-y-2 rounded-xl border border-line bg-ink-25 p-3">
          <Field label="Date et heure de publication (heure du Maroc)">
            <Input type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} />
          </Field>
          <Button size="sm" disabled={pending || !when} onClick={() => run(() => setNewsStatus(article.id, "schedule", when))}>
            Confirmer la programmation
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {live ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setNewsStatus(article.id, "unpublish"))}>
            Repasser en brouillon
          </Button>
        ) : null}
        {article.status !== "archived" ? (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setNewsStatus(article.id, "archive"))}>
            Archiver
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setNewsStatus(article.id, "restore"))}>
            Restaurer en brouillon
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Cover image ───────────────────────────────────────────────────────── */

export function NewsCoverPanel({ article }: { article: AdminNewsArticle }) {
  const router = useRouter();
  const src = newsImageUrl(article.cover_path);
  return (
    <div className="space-y-4">
      {src ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={article.cover_alt || "Image de couverture"} className="aspect-[16/9] w-full rounded-lg border border-line object-cover" />
          {!article.cover_alt ? <p className="text-caption text-warning-700">Ajoutez un texte alternatif à l’image (section « Adresse et options »).</p> : null}
          <ActionButton action={setNewsCover.bind(null, article.id, null)} variant="danger-ghost">
            <Trash2 aria-hidden /> Retirer l’image
          </ActionButton>
        </div>
      ) : null}
      <FileUploader
        bucket={NEWS_BUCKET}
        accept={IMAGE_TYPES}
        maxBytes={IMAGE_MAX}
        buildPath={(file) => `${article.id}/cover-${Date.now().toString(36)}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`}
        onUploaded={async (path) => {
          const res = await setNewsCover(article.id, path);
          if (res.ok) router.refresh();
          return res;
        }}
        label={src ? "Remplacer l’image" : "Ajouter une image de couverture"}
        hint="JPEG, PNG ou WebP · 5 Mo maximum · format paysage 16:9 conseillé (1600 × 900 px)."
      />
    </div>
  );
}

/* ─── Categories ────────────────────────────────────────────────────────── */

export function NewsCategoryManager({ categories, usage }: { categories: NewsCategory[]; usage: Record<string, number> }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {categories.map((c) => (
          <li key={c.id} className="p-3">
            {editing === c.id ? (
              <CategoryForm category={c} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{c.name}</p>
                  <p className="text-caption text-ink-500">
                    /actualites?categorie={c.slug} · {usage[c.id] ?? 0} article{(usage[c.id] ?? 0) > 1 ? "s" : ""}
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ActionButton action={moveNewsCategory.bind(null, c.id, "up")} variant="ghost">
                    <ArrowUp aria-hidden />
                    <span className="sr-only">Monter {c.name}</span>
                  </ActionButton>
                  <ActionButton action={moveNewsCategory.bind(null, c.id, "down")} variant="ghost">
                    <ArrowDown aria-hidden />
                    <span className="sr-only">Descendre {c.name}</span>
                  </ActionButton>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c.id)}>
                    <Pencil aria-hidden /> Modifier
                  </Button>
                  <ActionButton
                    action={deleteNewsCategory.bind(null, c.id)}
                    variant="danger-ghost"
                    confirm={{
                      title: `Supprimer la catégorie « ${c.name} » ?`,
                      description: "Les brouillons qui l’utilisent deviendront sans catégorie. Une catégorie utilisée par des articles publiés ne peut pas être supprimée.",
                      confirmLabel: "Supprimer",
                      tone: "danger",
                    }}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">Supprimer {c.name}</span>
                  </ActionButton>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-dashed border-line-strong p-4">
        <h2 className="mb-3 text-body font-semibold text-ink-900">Nouvelle catégorie</h2>
        <CategoryForm />
      </div>
    </div>
  );
}

function CategoryForm({ category, onDone }: { category?: NewsCategory; onDone?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(saveNewsCategory, INITIAL_ACTION_STATE);
  useActionToast(state, () => {
    formRef.current?.reset();
    onDone?.();
  });
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-start" noValidate>
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <Field label="Nom" error={e.name}>
        <Input name="name" defaultValue={category?.name} maxLength={80} required />
      </Field>
      <Field label="Description" optional error={e.description}>
        <Input name="description" defaultValue={category?.description} maxLength={300} />
      </Field>
      <div className="flex gap-2 sm:pt-6">
        <SubmitButton size="md">{category ? "Enregistrer" : "Ajouter"}</SubmitButton>
        {onDone ? (
          <Button variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        ) : null}
      </div>
      {!state.ok && state.message ? (
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}
