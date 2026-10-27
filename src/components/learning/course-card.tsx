import Link from "next/link";
import { ArrowRight, Award, BookOpen, ClipboardCheck, Clock, Lock, PlayCircle, Signal } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/surface";
import { formatDuration, formatRelative } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { coverUrl } from "@/lib/media";
import type { LearnerCourse } from "@/server/queries/learning";

/** Neutral, typographic cover used when a course has no cover image. */
export function CoverFallback({ title, category, showLabel = true }: { title: string; category?: string | null; showLabel?: boolean }) {
  return (
    <div className="relative flex h-full w-full items-end overflow-hidden bg-brand-700 p-4">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div aria-hidden className="absolute -right-6 -top-6 size-28 rounded-full border-[14px] border-accent-500/40" />
      {showLabel ? (
        <span className="relative line-clamp-2 text-label font-medium uppercase tracking-wider text-brand-100">
          {category ?? title}
        </span>
      ) : null}
    </div>
  );
}

export function CourseCover({ path, title, category, className, imageClassName, fallbackLabel = true }: {
  path: string | null;
  title: string;
  category?: string | null;
  className?: string;
  /** e.g. "object-left" when a narrow frame must keep the cover's title visible. */
  imageClassName?: string;
  /** False when the frame already shows the category (avoids overlapping text). */
  fallbackLabel?: boolean;
}) {
  const url = coverUrl(path);
  return (
    <div className={className}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- public bucket URL, sized by CSS
        <img src={url} alt="" className={cn("h-full w-full object-cover", imageClassName)} loading="lazy" />
      ) : (
        <CoverFallback title={title} category={category} showLabel={fallbackLabel} />
      )}
    </div>
  );
}

export function CourseStatusBadge({ course }: { course: LearnerCourse }) {
  if (!course.has_access) return <Badge tone="neutral">Accès suspendu</Badge>;
  if (course.enrollment_status === "completed") return <Badge tone="success" dot>Terminée</Badge>;
  if (course.started_at) return <Badge tone="accent" dot>En cours</Badge>;
  return <Badge tone="brand">À commencer</Badge>;
}

/** Share of a course done: mandatory lessons and module evaluations together. */
export function courseRatio(course: Pick<LearnerCourse, "mandatory_lessons" | "completed_lessons" | "quizzes_total" | "quizzes_passed">) {
  const total = course.mandatory_lessons + course.quizzes_total;
  return total ? (course.completed_lessons + course.quizzes_passed) / total : 0;
}

/** Circular progress with the percentage in the middle. */
export function PercentRing({
  value,
  size = 52,
  stroke = 5,
  tone = "accent",
  label,
  className,
  invert = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "success";
  label: string;
  className?: string;
  /** Light text and track, for dark backgrounds. */
  invert?: boolean;
}) {
  const pct = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={invert ? "stroke-white/15" : "stroke-ink-100"} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-700", tone === "success" ? "stroke-success-600" : "stroke-accent-500")}
        />
      </svg>
      <span
        aria-hidden
        className={cn(
          "tabular absolute font-semibold",
          size >= 96 ? "text-title" : size >= 64 ? "text-card" : "text-caption",
          invert ? "text-white" : "text-ink-900",
        )}
      >
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function resumeHref(course: LearnerCourse) {
  const href = `/espace/formations/${course.course_id}`;
  return course.resume_lesson_id ? `${href}/lecons/${course.resume_lesson_id}` : href;
}

/**
 * Course tile for a teacher: cover with category and status, title and
 * summary, then a progress ring with lessons and evaluations, and the action.
 */
export function LearnerCourseCard({ course }: { course: LearnerCourse }) {
  const ratio = courseRatio(course);
  const href = `/espace/formations/${course.course_id}`;
  const completed = course.enrollment_status === "completed";
  const locked = !course.has_access;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-[box-shadow,transform,border-color] duration-300 ease-[var(--ease-out-strong)]",
        locked ? "opacity-80" : "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop",
      )}
    >
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden" tabIndex={-1} aria-hidden>
        <CourseCover
          path={course.cover_path}
          title={course.title}
          category={course.category}
          className="h-full"
          fallbackLabel={false}
          imageClassName={cn("transition-transform duration-500 ease-[var(--ease-out-strong)]", locked ? "grayscale" : "group-hover:scale-[1.04]")}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-900/75 via-brand-900/10 to-transparent" />
        {course.category ? (
          <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full bg-white/90 px-2.5 py-1 text-caption font-medium text-ink-800 shadow-xs backdrop-blur">
            {course.category}
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 flex items-center gap-3 text-caption font-medium text-white">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatDuration(course.estimated_minutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Signal className="size-3.5" aria-hidden /> {COURSE_LEVELS[course.level]}
          </span>
        </span>
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-ink-700 shadow-pop">
              <Lock className="size-5" />
            </span>
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2.5">
          <CourseStatusBadge course={course} />
        </div>
        <h3 className="text-[1.0625rem] font-semibold leading-snug text-ink-900">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>
        {course.summary ? <p className="mt-1.5 line-clamp-2 text-body text-ink-500">{course.summary}</p> : null}

        <div className="mt-auto pt-5">
          <div className="flex items-center gap-4 rounded-lg bg-ink-25 p-3 ring-1 ring-inset ring-line">
            <PercentRing value={ratio} tone={completed ? "success" : "accent"} label={`Progression : ${Math.round(ratio * 100)} %`} />
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 text-caption">
              <div>
                <dt className="flex items-center gap-1 text-ink-500">
                  <BookOpen className="size-3.5" aria-hidden /> Leçons
                </dt>
                <dd className="tabular mt-0.5 text-card font-semibold text-ink-900">
                  {course.completed_lessons}
                  <span className="font-normal text-ink-400">/{course.mandatory_lessons}</span>
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-ink-500">
                  <ClipboardCheck className="size-3.5" aria-hidden /> Évaluations
                </dt>
                <dd className="tabular mt-0.5 text-card font-semibold text-ink-900">
                  {course.quizzes_passed}
                  <span className="font-normal text-ink-400">/{course.quizzes_total}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="truncate text-caption text-ink-500">
              {locked
                ? "Progression conservée"
                : completed
                  ? "Formation validée"
                  : course.last_activity_at
                    ? `Vu ${formatRelative(course.last_activity_at)}`
                    : "Pas encore commencée"}
            </span>
            {locked ? (
              <span className="inline-flex items-center gap-1 text-caption font-medium text-ink-500">
                <Lock className="size-3.5" aria-hidden /> Indisponible
              </span>
            ) : completed ? (
              <Link href="/espace/certificats" className={buttonClasses({ variant: "secondary", size: "sm", className: "relative z-10" })}>
                <Award /> Certificat
              </Link>
            ) : (
              <Link href={resumeHref(course)} className={buttonClasses({ variant: course.started_at ? "primary" : "accent", size: "sm", className: "relative z-10" })}>
                {course.started_at ? "Reprendre" : "Commencer"} <ArrowRight />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Wide card for the course the teacher was last working on. */
export function ResumeCourseCard({ course }: { course: LearnerCourse }) {
  const ratio = courseRatio(course);
  return (
    <article className="group relative overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="relative aspect-[16/9] overflow-hidden md:aspect-auto md:h-full">
          <CourseCover path={course.cover_path} title={course.title} category={course.category} className="h-full" imageClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-transparent to-brand-900/20" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-white/95 text-accent-700 shadow-pop transition-transform duration-300 group-hover:scale-110">
              <PlayCircle className="size-7" aria-hidden />
            </span>
          </span>
        </div>
        <div className="flex flex-col justify-center gap-4 p-6">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-accent-700">Reprendre là où vous en étiez</p>
            <h3 className="mt-1.5 text-section font-semibold text-ink-900">
              <Link href={resumeHref(course)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {course.title}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-2 text-body text-ink-500">{course.summary}</p>
          </div>
          <div className="max-w-md">
            <div className="mb-1.5 flex justify-between text-caption text-ink-600">
              <span>
                {course.completed_lessons}/{course.mandatory_lessons} leçons · {course.quizzes_passed}/{course.quizzes_total} évaluations
              </span>
              <span className="tabular font-semibold text-ink-900">{Math.round(ratio * 100)} %</span>
            </div>
            <ProgressBar value={ratio} label="Progression de la formation" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={buttonClasses({ size: "md", className: "pointer-events-none" })}>
              Continuer <ArrowRight />
            </span>
            {course.last_activity_at ? <span className="text-caption text-ink-500">Dernière activité {formatRelative(course.last_activity_at)}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
