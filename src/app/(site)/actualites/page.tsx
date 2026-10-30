import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Newspaper, Search, SearchX, TriangleAlert } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { FeaturedNews, NewsCard } from "@/components/news/news-cards";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { NEWS_PAGE_SIZE } from "@/lib/news";
import { getNewsCategories, getNewsFeed } from "@/server/queries/news";

export const metadata: Metadata = {
  title: "Actualités",
  description: "Annonces, nouvelles formations, événements et témoignages de la Fondation Sanady et de sa communauté éducative.",
  alternates: { canonical: "/actualites" },
};

function href(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== "" && !(e[0] === "page" && Number(e[1]) <= 1))
      .map(([k, v]) => [k, String(v)]),
  );
  const qs = search.toString();
  return qs ? `/actualites?${qs}` : "/actualites";
}

export default async function NewsPage({ searchParams }: PageProps<"/actualites">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const q = one(sp.q)?.slice(0, 100);
  const categorie = one(sp.categorie);
  const page = Math.max(1, Math.min(500, Number(one(sp.page)) || 1));
  const sort = one(sp.tri) === "pertinence" && q ? "relevance" : "recent";
  const current = { q, categorie, tri: sort === "relevance" ? "pertinence" : undefined };
  const filtered = Boolean(q || categorie);

  const categories = await getNewsCategories();
  const activeCategory = categories.find((c) => c.slug === categorie);
  // « À la une »: on the unfiltered first page, the latest featured article (or the latest one).
  const featured = !filtered && page === 1 ? ((await getNewsFeed({ featured: true, pageSize: 1 })).items[0] ?? null) : null;
  const feed = await getNewsFeed({ q, category: activeCategory?.slug ?? (categorie ? "__aucune__" : undefined), page, sort, exclude: featured?.id });
  const lead = !filtered && page === 1 && !featured ? (feed.items[0] ?? null) : featured;
  const items = lead && !featured ? feed.items.slice(1) : feed.items;
  const pages = Math.max(1, Math.ceil(feed.total / NEWS_PAGE_SIZE));

  const chip = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-label font-medium transition-colors",
      active ? "bg-brand-800 text-white shadow-xs" : "bg-surface text-ink-700 ring-1 ring-inset ring-line hover:bg-ink-50 hover:text-ink-900",
    );

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-ink-25">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-25" />
        <div aria-hidden className="bg-zellige-rosette-accent pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.1] [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-label font-medium text-ink-500">
            <Link href="/" className="hover:text-ink-800 hover:underline">
              Accueil
            </Link>
            <span aria-hidden>/</span>
            {activeCategory ? (
              <>
                <Link href="/actualites" className="hover:text-ink-800 hover:underline">
                  Actualités
                </Link>
                <span aria-hidden>/</span>
                <span className="font-semibold text-ink-800">{activeCategory.name}</span>
              </>
            ) : (
              <span className="font-semibold text-ink-800">Actualités</span>
            )}
          </nav>
          <p className="mt-5 inline-flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> {activeCategory ? "Catégorie" : "Le fil de la Fondation"}
          </p>
          <h1 className="mt-2 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.75rem]">
            {activeCategory ? activeCategory.name : "Actualités SANADY"}
          </h1>
          <p className="mt-2 max-w-2xl text-reading text-ink-600">
            {activeCategory?.description ||
              "Nouvelles formations, événements, ressources et témoignages : suivez la vie de la Fondation Sanady et de sa communauté éducative."}
          </p>
          <form action="/actualites" role="search" className="mt-6 flex max-w-2xl flex-col gap-2.5 sm:flex-row">
            {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
            <label className="relative flex-1">
              <span className="sr-only">Rechercher une actualité</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Rechercher une actualité, un thème, un événement…"
                className="h-12 w-full rounded-xl border border-line-strong bg-surface pl-11 pr-4 text-body text-ink-900 shadow-xs placeholder:text-ink-500 transition-all focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
              />
            </label>
            <button type="submit" className={buttonClasses({ variant: "accent", size: "lg", className: "h-12 rounded-xl shadow-xs" })}>
              Rechercher
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {categories.length ? (
          <nav aria-label="Catégories" className="-mx-4 mb-8 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <ul className="flex gap-2 sm:flex-wrap">
              <li>
                <Link href={href({ q })} className={chip(!categorie)} aria-current={!categorie ? "page" : undefined}>
                  Toutes
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={href({ q, categorie: c.slug })} className={chip(categorie === c.slug)} aria-current={categorie === c.slug ? "page" : undefined}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {feed.failed ? (
          <div role="alert" className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-xs">
            <TriangleAlert className="size-8 text-warning-600" aria-hidden />
            <p className="mt-3 text-section font-semibold text-ink-900">Les actualités sont momentanément indisponibles.</p>
            <p className="mt-1 max-w-md text-body text-ink-600">Veuillez réessayer dans quelques instants.</p>
          </div>
        ) : (
          <>
            {lead ? (
              <Reveal from="zoom" className="mb-12">
                <FeaturedNews article={lead} />
              </Reveal>
            ) : null}

            {filtered || items.length ? (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-body text-ink-600" aria-live="polite">
                  {filtered ? (
                    <>
                      <span className="font-bold text-ink-900">{feed.total}</span> {feed.total > 1 ? "articles" : "article"}
                      {q ? (
                        <>
                          {" "}
                          pour « <span className="font-medium text-ink-900">{q}</span> »
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-section font-bold text-ink-900">Dernières actualités</span>
                  )}
                </h2>
                {q ? (
                  <nav aria-label="Trier" className="flex items-center gap-1.5 text-label">
                    <span className="mr-1 text-ink-500">Trier :</span>
                    {(
                      [
                        ["recent", "Les plus récentes"],
                        ["relevance", "Pertinence"],
                      ] as const
                    ).map(([value, label]) => (
                      <Link
                        key={value}
                        href={href({ ...current, tri: value === "relevance" ? "pertinence" : undefined })}
                        aria-current={sort === value ? "true" : undefined}
                        className={cn("rounded-xl px-3 py-1.5 font-medium transition-all", sort === value ? "bg-brand-700 text-white shadow-xs" : "text-ink-700 hover:bg-ink-100")}
                      >
                        {label}
                      </Link>
                    ))}
                  </nav>
                ) : null}
              </div>
            ) : null}

            {items.length ? (
              <Reveal from="stagger" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((a) => (
                  <NewsCard key={a.id} article={a} />
                ))}
              </Reveal>
            ) : filtered ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
                <SearchX className="size-8 text-ink-400" aria-hidden />
                <p className="mt-3 text-section font-semibold text-ink-900">Aucun article ne correspond à votre recherche.</p>
                <p className="mt-1 max-w-md text-body text-ink-600">Essayez d’autres mots-clés ou une autre catégorie.</p>
                <Link href="/actualites" className={buttonClasses({ variant: "secondary", className: "mt-5" })}>
                  Voir toutes les actualités
                </Link>
              </div>
            ) : !lead ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                  <Newspaper className="size-7" aria-hidden />
                </span>
                <p className="mt-4 text-section font-semibold text-ink-900">Les premières actualités arrivent bientôt.</p>
                <p className="mt-1 max-w-md text-body text-ink-600">En attendant, découvrez les formations proposées aux enseignants.</p>
                <Link href="/formations" className={buttonClasses({ variant: "accent", className: "mt-5" })}>
                  Voir les formations <ArrowRight aria-hidden />
                </Link>
              </div>
            ) : null}

            {pages > 1 ? (
              <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href={href({ ...current, page: page - 1 })}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  className={cn(buttonClasses({ variant: "secondary" }), page <= 1 && "pointer-events-none opacity-45")}
                >
                  <ArrowLeft aria-hidden /> Précédent
                </Link>
                <ol className="flex items-center gap-1">
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
                    .map((p, i, list) => (
                      <li key={p} className="flex items-center gap-1">
                        {i > 0 && p - list[i - 1]! > 1 ? <span className="px-1 text-ink-400">…</span> : null}
                        <Link
                          href={href({ ...current, page: p })}
                          aria-current={p === page ? "page" : undefined}
                          aria-label={`Page ${p}`}
                          className={cn(
                            "tabular flex size-9 items-center justify-center rounded-lg text-label font-semibold transition-colors",
                            p === page ? "bg-brand-800 text-white" : "text-ink-700 hover:bg-ink-100",
                          )}
                        >
                          {p}
                        </Link>
                      </li>
                    ))}
                </ol>
                <Link
                  href={href({ ...current, page: page + 1 })}
                  aria-disabled={page >= pages}
                  tabIndex={page >= pages ? -1 : undefined}
                  className={cn(buttonClasses({ variant: "secondary" }), page >= pages && "pointer-events-none opacity-45")}
                >
                  Suivant <ArrowRight aria-hidden />
                </Link>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
