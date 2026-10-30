import { Fragment, type ReactNode } from "react";
import { ExternalLink, PlayCircle } from "lucide-react";
import { newsImageUrl } from "@/lib/news";
import { parseArticle, type Inline } from "@/lib/news-markup";
import { cn } from "@/lib/cn";

/**
 * Renders an article body (see news-markup.ts) as React elements: no HTML is
 * ever injected. Used by the article page and the editor's live preview.
 */
export function NewsBody({ source, className }: { source: string; className?: string }) {
  const blocks = parseArticle(source);
  return (
    <div className={cn("space-y-5 text-[1.0625rem] leading-[1.75] text-ink-800", className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
            return (
              <h2 key={i} id={b.id} className="scroll-mt-28 pt-4 text-[1.5rem] font-bold leading-tight tracking-tight text-ink-900">
                {renderInline(b.c)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} id={b.id} className="scroll-mt-28 pt-2 text-[1.1875rem] font-semibold leading-snug text-ink-900">
                {renderInline(b.c)}
              </h3>
            );
          case "p":
            return <p key={i}>{renderInline(b.c)}</p>;
          case "ul":
            return (
              <ul key={i} className="space-y-2 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent-500" />
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="space-y-2 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden className="tabular min-w-5 font-semibold text-accent-700">
                      {j + 1}.
                    </span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i} className="relative rounded-r-xl border-l-4 border-accent-500 bg-accent-50/60 py-4 pl-6 pr-5 text-[1.125rem] italic leading-relaxed text-ink-800">
                {b.lines.map((line, j) => (
                  <p key={j}>{renderInline(line)}</p>
                ))}
              </blockquote>
            );
          case "image": {
            const src = newsImageUrl(b.path);
            return src ? (
              <figure key={i} className="py-2">
                {/* Uploaded article image (public bucket); dimensions unknown, so a plain img. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={b.alt} loading="lazy" decoding="async" className="w-full rounded-xl border border-line bg-ink-50 object-cover" />
                {b.caption ? <figcaption className="mt-2 text-center text-label text-ink-500">{b.caption}</figcaption> : null}
              </figure>
            ) : null;
          }
          case "video":
            return (
              <a
                key={i}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 no-underline shadow-xs transition hover:border-accent-300 hover:shadow-sm"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white transition-transform group-hover:scale-105">
                  <PlayCircle className="size-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-ink-900">Regarder la vidéo</span>
                  <span className="block truncate text-label text-ink-500">Sur {b.label} · s’ouvre dans un nouvel onglet</span>
                </span>
                <ExternalLink className="ml-auto size-4 shrink-0 text-ink-400" aria-hidden />
              </a>
            );
          case "hr":
            return <hr key={i} className="mx-auto my-8 w-24 border-t-2 border-accent-200" />;
        }
      })}
    </div>
  );
}

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}>{n.v}</Fragment>;
      case "strong":
        return (
          <strong key={i} className="font-semibold text-ink-900">
            {renderInline(n.c)}
          </strong>
        );
      case "em":
        return <em key={i}>{renderInline(n.c)}</em>;
      case "link":
        return (
          <a
            key={i}
            href={n.href}
            {...(n.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="font-medium text-accent-700 underline decoration-accent-300 underline-offset-[3px] hover:decoration-accent-600"
          >
            {renderInline(n.c)}
            {n.external ? <span className="sr-only"> (nouvel onglet)</span> : null}
          </a>
        );
    }
  });
}
