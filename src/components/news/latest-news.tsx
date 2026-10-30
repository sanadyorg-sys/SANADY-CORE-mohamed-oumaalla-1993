import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { NewsCard } from "@/components/news/news-cards";
import { Reveal } from "@/components/ui/motion";
import { getNewsFeed } from "@/server/queries/news";

/** Home page: the three latest articles the visitor may read (nothing when there is none). */
export async function LatestNews() {
  const { items } = await getNewsFeed({ pageSize: 3 });
  if (!items.length) return null;
  return (
    <section aria-labelledby="dernieres-actualites" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Actualités
          </p>
          <h2 id="dernieres-actualites" className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.25rem]">
            Les dernières nouvelles de la Fondation
          </h2>
        </div>
        <Link href="/actualites" className="group inline-flex items-center gap-1.5 text-body font-semibold text-accent-700 hover:text-accent-800">
          Toutes les actualités
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </Reveal>
      <Reveal from="stagger" className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <NewsCard key={a.id} article={a} />
        ))}
      </Reveal>
    </section>
  );
}
