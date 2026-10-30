import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Lock, MapPin, Video } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { cn } from "@/lib/cn";
import { formatEventWhen, formatNewsDate, newsImageUrl, type NewsCard as NewsCardData } from "@/lib/news";

/** Article image, or a branded panel (rosette pattern + category) when there is none. */
export function NewsCover({
  path,
  alt,
  category,
  className,
  priority = false,
}: {
  path: string | null;
  alt: string;
  category?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const src = newsImageUrl(path);
  if (src) {
    return (
      // Public bucket image of unknown size: plain img, cropped by its frame.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={cn("h-full w-full object-cover", className)} />
    );
  }
  return (
    <div aria-hidden className={cn("relative flex h-full w-full items-end overflow-hidden bg-brand-800 p-5", className)}>
      <div className="bg-zellige-rosette absolute inset-0 opacity-[0.14]" />
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-accent-500/25 blur-2xl" />
      <span className="relative inline-flex items-center gap-2 text-label font-semibold text-white/85">
        <BrandDots /> {category ?? "Actualité SANADY"}
      </span>
    </div>
  );
}

function Meta({ article, light = false }: { article: NewsCardData; light?: boolean }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-caption", light ? "text-white/70" : "text-ink-500")}>
      <time dateTime={article.published_at}>{formatNewsDate(article.published_at)}</time>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden /> {article.reading_minutes} min de lecture
      </span>
      {article.visibility !== "public" ? (
        <span className={cn("inline-flex items-center gap-1 font-medium", light ? "text-accent-200" : "text-accent-800")}>
          <Lock className="size-3.5" aria-hidden /> {article.visibility === "members" ? "Réservé aux membres" : "Réservé à votre établissement"}
        </span>
      ) : null}
    </p>
  );
}

function EventLine({ article }: { article: NewsCardData }) {
  if (!article.event_starts_at) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-accent-50 px-3 py-2 text-caption font-medium text-accent-900">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" aria-hidden /> {formatEventWhen(article.event_starts_at)}
      </span>
      {article.event_online ? (
        <span className="inline-flex items-center gap-1.5">
          <Video className="size-3.5" aria-hidden /> En ligne
        </span>
      ) : article.event_location ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden /> {article.event_location}
        </span>
      ) : null}
    </p>
  );
}

/** Card of the article grid: the whole card is one link. */
export function NewsCard({ article, headingLevel = "h3" }: { article: NewsCardData; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-ink-100">
        <NewsCover
          path={article.cover_path}
          alt={article.cover_alt}
          category={article.category_name}
          className="transition duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
        {article.category_name ? (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-line/50 bg-surface/90 px-2.5 py-0.5 text-caption font-semibold text-accent-800 shadow-xs backdrop-blur-sm">
            {article.category_name}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Meta article={article} />
        <Heading className="mt-2 text-section font-bold leading-snug tracking-tight text-ink-900 transition-colors group-hover:text-accent-700">
          <Link href={`/actualites/${article.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {article.title}
          </Link>
        </Heading>
        {article.excerpt ? <p className="mt-2 line-clamp-3 text-body leading-relaxed text-ink-600">{article.excerpt}</p> : null}
        <EventLine article={article} />
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-label font-semibold text-accent-700">
          Lire l’article
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </span>
      </div>
    </article>
  );
}

/** Large « À la une » article at the top of the news page. */
export function FeaturedNews({ article }: { article: NewsCardData }) {
  return (
    <article className="group relative grid overflow-hidden rounded-3xl border border-line bg-brand-900 text-white shadow-md lg:grid-cols-[1.15fr_1fr]">
      <div className="relative aspect-[16/9] overflow-hidden lg:aspect-auto lg:min-h-[22rem]">
        <NewsCover
          path={article.cover_path}
          alt={article.cover_alt}
          priority
          className="transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1 text-caption font-bold uppercase tracking-wider text-white shadow-md">
          À la une
        </span>
      </div>
      <div className="relative flex flex-col justify-center p-6 sm:p-8 lg:p-10">
        <div aria-hidden className="bg-zellige-rosette absolute inset-0 opacity-[0.06]" />
        <div className="relative">
          {article.category_name ? (
            <p className="mb-3 inline-flex items-center gap-2 text-label font-semibold text-accent-300">
              <BrandDots /> {article.category_name}
            </p>
          ) : null}
          <h2 className="text-[1.625rem] font-bold leading-tight tracking-tight sm:text-[2rem]">
            <Link href={`/actualites/${article.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {article.title}
            </Link>
          </h2>
          {article.excerpt ? <p className="mt-3 line-clamp-4 text-reading leading-relaxed text-white/80">{article.excerpt}</p> : null}
          <div className="mt-4">
            <Meta article={article} light />
          </div>
          <span className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-body font-semibold text-ink-900 shadow-sm transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none">
            Lire l’article <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
