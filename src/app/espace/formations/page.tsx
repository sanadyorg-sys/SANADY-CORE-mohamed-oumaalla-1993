import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, Clock, Search, X } from "lucide-react";
import { LearnerCourseCard, ResumeCourseCard } from "@/components/learning/course-card";
import { EmptyState } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { foldAccents } from "@/server/queries/library";
import { requireViewer } from "@/server/auth";
import { getLearnerCourses, type LearnerCourse } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Mes formations" };

const FILTERS = {
  en_cours: { label: "En cours", test: (c: LearnerCourse) => c.has_access && c.enrollment_status === "active" && Boolean(c.started_at) },
  a_commencer: { label: "À commencer", test: (c: LearnerCourse) => c.has_access && c.enrollment_status === "active" && !c.started_at },
  terminees: { label: "Terminées", test: (c: LearnerCourse) => c.enrollment_status === "completed" },
  toutes: { label: "Toutes", test: () => true },
} as const;
type FilterKey = keyof typeof FILTERS;

const hrefFor = (key: FilterKey, q?: string) => {
  const params = new URLSearchParams();
  if (key !== "toutes") params.set("filtre", key);
  if (q) params.set("q", q);
  const s = params.toString();
  return s ? `/espace/formations?${s}` : "/espace/formations";
};

export default async function MyCoursesPage(props: PageProps<"/espace/formations">) {
  await requireViewer();
  const { filtre, q: rawQ } = await props.searchParams;
  const key: FilterKey = typeof filtre === "string" && filtre in FILTERS ? (filtre as FilterKey) : "toutes";
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 100) : "";
  const courses = await getLearnerCourses();

  const needle = foldAccents(q);
  const matching = needle
    ? courses.filter((c) => foldAccents(`${c.title} ${c.summary} ${c.category ?? ""}`).includes(needle))
    : courses;
  // In progress first, then not started, completed, and unavailable last.
  const rank = (c: LearnerCourse) => (!c.has_access ? 3 : c.enrollment_status === "completed" ? 2 : c.started_at ? 0 : 1);
  const visible = matching
    .filter(FILTERS[key].test)
    .sort((a, b) => rank(a) - rank(b) || (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""));

  const inProgress = courses.filter(FILTERS.en_cours.test);
  const resume = [...inProgress].sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""))[0];
  const completed = courses.filter(FILTERS.terminees.test);
  const totalMinutes = courses.filter((c) => c.has_access).reduce((s, c) => s + (c.estimated_minutes ?? 0), 0);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Espace enseignant</p>
          <h1 className="mt-1 text-display font-semibold text-ink-900">Mes formations</h1>
          <p className="mt-2 text-reading text-ink-600">
            Les formations qui vous ont été attribuées par SANADY ou votre établissement, à suivre à votre rythme.
          </p>
        </div>
        <dl className="grid w-full grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-xs sm:w-auto">
          <Summary icon={BookOpen} label="En cours" value={inProgress.length} />
          <Summary icon={Award} label="Terminées" value={completed.length} />
          <Summary icon={Clock} label="De formation" value={formatDuration(totalMinutes)} />
        </dl>
      </header>

      {resume && key !== "terminees" && !q ? (
        <section aria-label="Reprendre" className="mb-10">
          <ResumeCourseCard course={resume} />
        </section>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrer les formations" className="-mx-1 overflow-x-auto px-1">
          <ul className="flex gap-2">
            {(Object.keys(FILTERS) as FilterKey[]).map((k) => {
              const active = k === key;
              const count = matching.filter(FILTERS[k].test).length;
              return (
                <li key={k}>
                  <Link
                    href={hrefFor(k, q)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-body font-medium transition-colors",
                      active ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-surface text-ink-700 hover:border-line-strong hover:bg-ink-50",
                    )}
                  >
                    {FILTERS[k].label}
                    <span className={cn("tabular rounded-full px-1.5 text-caption", active ? "bg-white/15 text-white" : "bg-ink-100 text-ink-600")}>{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <form action="/espace/formations" method="get" role="search" className="relative w-full lg:w-80">
          {key !== "toutes" ? <input type="hidden" name="filtre" value={key} /> : null}
          <label htmlFor="q" className="sr-only">
            Rechercher une formation
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Rechercher une formation…"
            className="h-10 w-full rounded-full border border-line-strong bg-surface pl-10 pr-4 text-body text-ink-900 shadow-xs placeholder:text-ink-400 hover:border-ink-400 focus-visible:border-accent-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-600/15"
          />
        </form>
      </div>

      {q ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-body text-ink-600">
          {visible.length} résultat{visible.length > 1 ? "s" : ""} pour « <span className="font-medium text-ink-900">{q}</span> »
          <Link href={hrefFor(key)} className="inline-flex items-center gap-1 text-label font-medium text-accent-700 hover:underline">
            <X className="size-3.5" aria-hidden /> Effacer
          </Link>
        </p>
      ) : null}

      {visible.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <LearnerCourseCard key={c.course_id} course={c} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={q ? Search : BookOpen}
            title={q ? "Aucune formation ne correspond à votre recherche" : key === "terminees" ? "Aucune formation terminée pour le moment" : "Aucune formation dans cette catégorie"}
            description={
              q
                ? "Essayez un autre mot-clé ou affichez toutes vos formations."
                : key === "terminees"
                  ? "Une formation est terminée lorsque toutes ses leçons obligatoires sont suivies et toutes ses évaluations réussies."
                  : "Les formations vous sont attribuées par l’équipe SANADY ou par votre établissement."
            }
          />
        </Card>
      )}
    </>
  );
}

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3">
      <dt className="flex items-center gap-1.5 text-caption text-ink-500">
        <Icon className="size-3.5 text-accent-600" aria-hidden /> {label}
      </dt>
      <dd className="tabular mt-0.5 text-section font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
