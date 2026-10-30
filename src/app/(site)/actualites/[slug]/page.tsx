import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Eye, Lock, MapPin, Pencil, Video } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { CourseCover } from "@/components/learning/course-card";
import { NewsBody } from "@/components/news/news-body";
import { NewsCover } from "@/components/news/news-cards";
import { NewsShare } from "@/components/news/news-share";
import { NewsViewBeacon } from "@/components/news/news-view-beacon";
import { buttonClasses } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { formatEventWhen, formatNewsDate, newsImageUrl, NEWS_STATUS_LABELS, newsDisplayStatus } from "@/lib/news";
import { getNewsArticle } from "@/server/queries/news";

type Props = PageProps<"/actualites/[slug]">;

async function load(props: Props) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  const preview = sp.apercu === "1";
  return { article: await getNewsArticle(slug, preview), preview };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { article, preview } = await load(props);
  if (!article) return { title: "Article introuvable", robots: { index: false, follow: false } };
  const image = newsImageUrl(article.cover_path);
  // Restricted articles and previews: nothing for search engines or link previews.
  if (article.visibility !== "public" || preview) {
    return { title: article.title, robots: { index: false, follow: false } };
  }
  return {
    title: article.title,
    description: article.excerpt || undefined,
    alternates: { canonical: `/actualites/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt || undefined,
      url: `${publicEnv.appUrl}/actualites/${article.slug}`,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
      authors: [article.author_label],
      section: article.category?.name,
      images: image ? [{ url: image, alt: article.cover_alt || article.title }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: article.title, description: article.excerpt || undefined },
  };
}

export default async function NewsArticlePage(props: Props) {
  const { article, preview } = await load(props);
  if (!article) notFound();

  const status = newsDisplayStatus(article);
  const visible = status === "published";
  const url = `${publicEnv.appUrl}/actualites/${article.slug}`;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd =
    article.visibility === "public" && visible
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: article.title,
          description: article.excerpt || undefined,
          image: newsImageUrl(article.cover_path) ?? undefined,
          datePublished: article.published_at,
          dateModified: article.updated_at,
          author: { "@type": "Organization", name: article.author_label },
          publisher: { "@type": "Organization", name: "Fondation Sanady" },
          mainEntityOfPage: url,
        }).replace(/</g, "\\u003c")
      : null;

  return (
    <article>
      {jsonLd ? <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      {visible && !preview ? <NewsViewBeacon slug={article.slug} /> : null}

      {preview ? (
        <div className="border-b border-warning-200 bg-warning-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-label sm:px-6 lg:px-8">
            <p className="inline-flex items-center gap-2 font-medium text-warning-900">
              <Eye className="size-4" aria-hidden /> Aperçu — statut : {NEWS_STATUS_LABELS[status]}
              {article.visibility !== "public" ? " · public restreint" : ""}
            </p>
            <Link href={`/admin/actualites/${article.id}`} className="inline-flex items-center gap-1.5 font-semibold text-warning-900 underline underline-offset-2">
              <Pencil className="size-3.5" aria-hidden /> Revenir à l’édition
            </Link>
          </div>
        </div>
      ) : null}

      <header className="relative overflow-hidden border-b border-line bg-ink-25">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-20" />
        <div className="relative mx-auto max-w-3xl px-4 pb-8 pt-8 sm:px-6 lg:pt-12">
          <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-label font-medium text-ink-500">
            <Link href="/" className="hover:text-ink-800 hover:underline">
              Accueil
            </Link>
            <span aria-hidden>/</span>
            <Link href="/actualites" className="hover:text-ink-800 hover:underline">
              Actualités
            </Link>
            {article.category ? (
              <>
                <span aria-hidden>/</span>
                <Link href={`/actualites?categorie=${article.category.slug}`} className="hover:text-ink-800 hover:underline">
                  {article.category.name}
                </Link>
              </>
            ) : null}
          </nav>
          {article.category ? (
            <p className="mt-6 inline-flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> {article.category.name}
            </p>
          ) : null}
          <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.15] tracking-tight text-ink-900 [text-wrap:balance] sm:text-[2.625rem]">
            {article.title}
          </h1>
          {article.subtitle ? <p className="mt-3 text-[1.1875rem] leading-relaxed text-ink-600 [text-wrap:pretty]">{article.subtitle}</p> : null}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-label text-ink-600">
            <span className="inline-flex items-center gap-2 font-semibold text-ink-800">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-800 text-caption font-bold text-white" aria-hidden>
                {article.author_label.slice(0, 1).toUpperCase()}
              </span>
              {article.author_label}
            </span>
            {article.published_at ? (
              <time dateTime={article.published_at}>{formatNewsDate(article.published_at)}</time>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> {article.reading_minutes} min de lecture
            </span>
            {article.visibility !== "public" ? (
              <span className="inline-flex items-center gap-1 font-medium text-accent-800">
                <Lock className="size-4" aria-hidden /> {article.visibility === "members" ? "Réservé aux membres" : "Réservé à certains établissements"}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
        {article.cover_path ? (
          <figure className="-mx-4 mb-10 overflow-hidden sm:mx-0 sm:rounded-2xl sm:border sm:border-line sm:shadow-sm">
            <div className="aspect-[16/9] bg-ink-100">
              <NewsCover path={article.cover_path} alt={article.cover_alt} priority />
            </div>
          </figure>
        ) : null}

        {article.excerpt ? <p className="mb-8 text-[1.1875rem] font-medium leading-relaxed text-ink-900">{article.excerpt}</p> : null}

        {article.event ? (
          <aside aria-label="Événement" className="mb-10 overflow-hidden rounded-2xl border border-accent-200 bg-accent-50/70">
            <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white shadow-md shadow-accent-500/25">
                <CalendarDays className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-bold uppercase tracking-wider text-accent-800">Événement</p>
                <p className="mt-1 text-card font-semibold text-ink-900 first-letter:uppercase">{formatEventWhen(article.event.starts_at, article.event.ends_at)}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-body text-ink-700">
                  {article.event.online ? (
                    <>
                      <Video className="size-4" aria-hidden /> En ligne{article.event.location ? ` · ${article.event.location}` : ""}
                    </>
                  ) : article.event.location ? (
                    <>
                      <MapPin className="size-4" aria-hidden /> {article.event.location}
                    </>
                  ) : null}
                </p>
              </div>
              {article.event.has_registration && visible ? (
                <a
                  href={`/actualites/${article.slug}/inscription`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: "accent", className: "group w-full sm:w-auto" })}
                >
                  S’inscrire <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              ) : null}
            </div>
          </aside>
        ) : null}

        <NewsBody source={article.body} />

        {article.courses.length ? (
          <section aria-labelledby="formations-liees" className="mt-12 rounded-2xl border border-line bg-ink-25 p-5 sm:p-6">
            <h2 id="formations-liees" className="flex items-center gap-2 text-section font-bold text-ink-900">
              <BrandDots /> {article.courses.length > 1 ? "Les formations concernées" : "La formation concernée"}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {article.courses.map((c) => (
                <li key={c.id}>
                  <a
                    href={visible ? `/actualites/${article.slug}/formation/${c.id}` : c.accessible ? `/espace/formations/${c.id}` : `/formations/${c.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pr-4 shadow-xs transition hover:border-accent-500/40 hover:shadow-sm"
                  >
                    <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                      <CourseCover path={c.cover_path} title={c.title} fallbackLabel={false} className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-body font-semibold text-ink-900 group-hover:text-accent-700">{c.title}</span>
                      <span className="text-caption text-ink-500">{c.accessible ? "Ouvrir dans mon espace" : "Voir la formation"}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-accent-600 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-12 border-t border-line pt-6">
          {article.visibility === "public" && visible ? <NewsShare url={url} title={article.title} /> : null}
          {article.previous || article.next ? (
            <nav aria-label="Autres articles" className="mt-8 grid gap-3 sm:grid-cols-2">
              {article.previous ? (
                <Link href={`/actualites/${article.previous.slug}`} className="group rounded-xl border border-line p-4 transition hover:border-accent-500/40 hover:bg-ink-25">
                  <span className="inline-flex items-center gap-1 text-caption text-ink-500">
                    <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden /> Article précédent
                  </span>
                  <span className="mt-1 line-clamp-2 block text-body font-semibold text-ink-900">{article.previous.title}</span>
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
              {article.next ? (
                <Link href={`/actualites/${article.next.slug}`} className="group rounded-xl border border-line p-4 text-right transition hover:border-accent-500/40 hover:bg-ink-25">
                  <span className="inline-flex items-center gap-1 text-caption text-ink-500">
                    Article suivant <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="mt-1 line-clamp-2 block text-body font-semibold text-ink-900">{article.next.title}</span>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </footer>
      </div>

      {article.related.length ? (
        <section aria-labelledby="a-lire-aussi" className="border-t border-line bg-ink-25">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 id="a-lire-aussi" className="text-title font-bold tracking-tight text-ink-900">
                À lire aussi
              </h2>
              <Link href="/actualites" className="inline-flex items-center gap-1 text-label font-semibold text-accent-700 hover:underline">
                Toutes les actualités <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {article.related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/actualites/${r.slug}`} className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="block aspect-[16/9] overflow-hidden bg-ink-100">
                      <NewsCover path={r.cover_path} alt={r.cover_alt} category={article.category?.name} className="transition duration-500 group-hover:scale-105" />
                    </span>
                    <span className="block p-4">
                      <time dateTime={r.published_at} className="text-caption text-ink-500">
                        {formatNewsDate(r.published_at)}
                      </time>
                      <span className="mt-1 line-clamp-2 block text-body font-semibold text-ink-900 group-hover:text-accent-700">{r.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </article>
  );
}
