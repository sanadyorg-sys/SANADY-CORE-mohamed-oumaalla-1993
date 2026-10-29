import type { ReactNode } from "react";
import { BrandDots } from "@/components/brand/brand-decor";

export interface SpaceStat {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
}

/**
 * Page header of the teacher space: one framed band per page with its icon,
 * title and key figures, and the Moroccan rosette lattice fading in on the
 * right (same pattern as the public site's footer and « Pour qui ? » panel).
 */
export function SpaceHeader({
  icon: Icon,
  title,
  description,
  stats,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  stats?: SpaceStat[];
  actions?: ReactNode;
}) {
  return (
    <header className="animate-fade-up relative isolate mb-8 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
      <div
        aria-hidden
        className="bg-zellige-rosette-accent absolute inset-y-0 right-0 -z-10 w-2/3 opacity-[0.14] [mask-image:linear-gradient(to_left,black,transparent)]"
      />
      <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-accent-500/10 blur-3xl" />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 max-w-3xl items-start gap-4 sm:gap-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white shadow-md shadow-accent-500/25 sm:size-14">
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-accent-700">
              <BrandDots /> Espace enseignant
            </p>
            <h1 className="mt-1 text-title font-semibold tracking-tight text-ink-900 sm:text-display">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-body text-ink-600 sm:text-reading">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {stats?.length ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-ink-25/80 px-4 py-3 ring-1 ring-inset ring-line backdrop-blur-sm sm:min-w-40">
              <dt className="flex items-center gap-1.5 text-caption text-ink-500">
                <s.icon className="size-3.5 text-accent-600" aria-hidden /> {s.label}
              </dt>
              <dd className="tabular mt-0.5 text-section font-semibold text-ink-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
