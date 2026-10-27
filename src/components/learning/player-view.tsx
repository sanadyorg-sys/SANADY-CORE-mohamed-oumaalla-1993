import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, ClipboardCheck, Download, FileText, PlayCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/media";
import type { PlayerData } from "@/server/queries/player";
import { PercentRing } from "./course-card";
import { Curriculum } from "./curriculum";
import { CurriculumDrawer } from "./curriculum-drawer";
import { LessonExperience } from "./lesson-experience";

/**
 * Course player layout, built for focus.
 * Desktop: content + sticky curriculum panel. Tablet/mobile: content first,
 * curriculum available in a drawer — learning content is never squeezed.
 */
export function PlayerView({
  data,
  courseId,
  basePath,
  backHref,
  backLabel,
  preview = false,
  audience = "un enseignant",
}: {
  data: PlayerData;
  courseId: string;
  basePath: string;
  backHref: string;
  backLabel: string;
  preview?: boolean;
  /** Who will follow the course (preview banner). */
  audience?: string;
}) {
  const { lesson, outline, state } = data;
  const { totals } = outline;
  const steps = totals.mandatory + totals.quizzes;
  const ratio = steps ? (totals.completed + totals.quizzesPassed) / steps : 0;
  const completed = state.status === "completed" && !preview;
  const allLessons = outline.modules.flatMap((m) => m.lessons);
  const position = allLessons.findIndex((l) => l.id === lesson.id) + 1;
  const moduleIndex = outline.modules.findIndex((m) => m.lessons.some((l) => l.id === lesson.id)) + 1;

  const summary = (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-3.5">
        <PercentRing value={ratio} size={56} stroke={5} label={`Progression de la formation : ${Math.round(ratio * 100)} %`} />
        <div className="min-w-0">
          <p className="line-clamp-2 text-label font-semibold text-ink-900">{outline.course.title}</p>
          <p className="mt-0.5 text-caption text-ink-500">
            {totals.completed}/{totals.mandatory} leçons · {totals.quizzesPassed}/{totals.quizzes} évaluations
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Where am I */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1">
            <Link href={backHref} className="inline-flex max-w-full items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
              <ArrowLeft className="size-4 shrink-0" aria-hidden /> <span className="truncate">{backLabel}</span>
            </Link>
            {data.moduleTitle ? (
              <p className="mt-0.5 truncate text-caption text-ink-500">
                Module {moduleIndex} · {data.moduleTitle}
              </p>
            ) : null}
          </nav>
          <div className="flex items-center gap-2">
            {position > 0 ? (
              <span className="tabular rounded-full bg-ink-100 px-3 py-1 text-caption font-semibold text-ink-700">
                Leçon {position} sur {allLessons.length}
              </span>
            ) : null}
            <CurriculumDrawer courseId={courseId} modules={outline.modules} currentLessonId={lesson.id} basePath={basePath} summary={summary} />
          </div>
        </div>

        {preview ? (
          <Alert tone="info" className="mb-4">
            Mode aperçu : vous voyez la leçon telle qu’{audience} la verra. Aucune progression n’est enregistrée.
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-2xl shadow-sm">
          <LessonExperience
            lessonId={lesson.id}
            media={data.media}
            resumePosition={state.resume_position}
            watchedBuckets={state.watched_buckets}
            pagesViewed={state.pages_viewed}
            completionThreshold={data.threshold}
            preview={preview}
          />
        </div>

        {/* What is this lesson */}
        <header className="mt-7">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              {lesson.kind === "video" ? <PlayCircle className="size-3" aria-hidden /> : <FileText className="size-3" aria-hidden />}
              {lesson.kind === "video" ? "Vidéo" : "Document"}
            </Badge>
            {!lesson.is_mandatory ? <Badge>Facultative</Badge> : null}
            {completed ? (
              <Badge tone="success">
                <CircleCheck className="size-3" aria-hidden /> Terminée
              </Badge>
            ) : (
              <span className="text-caption text-ink-500">
                {lesson.kind === "video" ? "Terminée automatiquement après visionnage" : "Terminée automatiquement après lecture"}
              </span>
            )}
          </div>
          <h1 className="text-[1.625rem] font-bold leading-tight tracking-tight text-ink-900 sm:text-[1.875rem]">{lesson.title}</h1>
        </header>

        {lesson.description ? <div className="mt-4 max-w-3xl whitespace-pre-line text-reading text-ink-700">{lesson.description}</div> : null}

        {data.resources.length ? (
          <section className="mt-9" aria-labelledby="ressources">
            <h2 id="ressources" className="mb-3 text-section font-semibold text-ink-900">
              Ressources de la leçon
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.resources.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-body font-medium text-ink-800">{r.title}</span>
                    {r.size_bytes ? <span className="text-caption text-ink-500">PDF · {formatBytes(r.size_bytes)}</span> : null}
                  </span>
                  {r.url ? (
                    <a href={r.url} className={buttonClasses({ variant: "secondary", size: "icon-sm" })} download aria-label={`Télécharger ${r.title}`}>
                      <Download aria-hidden />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* What comes next */}
        <nav aria-label="Navigation entre les leçons" className="mt-10 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {data.previous ? (
            <Link href={data.previous.href} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-ink-25">
              <ArrowLeft className="size-5 shrink-0 text-ink-400 transition-transform group-hover:-translate-x-0.5" aria-hidden />
              <span className="min-w-0">
                <span className="block text-caption text-ink-500">Précédent</span>
                <span className="block truncate text-body font-medium text-ink-800">{data.previous.label}</span>
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {data.next ? (
            <Link
              href={data.next.href}
              className={cn(
                "group flex items-center justify-end gap-3 rounded-xl p-4 text-right transition-colors",
                "bg-brand-800 text-white hover:bg-brand-900",
              )}
            >
              <span className="min-w-0">
                <span className="block text-caption text-white/60">{data.next.kind === "quiz" ? "Ensuite : l’évaluation" : "Leçon suivante"}</span>
                <span className="block truncate text-body font-semibold">{data.next.label}</span>
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500 transition-transform group-hover:translate-x-0.5">
                {data.next.kind === "quiz" ? <ClipboardCheck className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
              </span>
            </Link>
          ) : (
            <Link href={backHref} className="flex items-center justify-end gap-2 rounded-xl border border-line bg-surface p-4 text-body font-medium text-ink-800 hover:bg-ink-25">
              Retour à la formation <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto pb-4">
          {summary}
          <Curriculum courseId={courseId} modules={outline.modules} currentLessonId={lesson.id} basePath={basePath} />
        </div>
      </aside>
    </div>
  );
}
