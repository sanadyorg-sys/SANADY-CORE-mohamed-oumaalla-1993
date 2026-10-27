"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, CircleCheck, ClipboardCheck, FileText, Lock, PlayCircle, Circle, TriangleAlert } from "lucide-react";
import { ProgressRing } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatClock, formatDuration } from "@/lib/format";
import { quizStatusLabel } from "@/lib/quiz";
import type { OutlineLesson, OutlineModule, OutlineQuiz } from "@/server/queries/learning";

function lessonMeta(lesson: OutlineLesson) {
  if (lesson.kind === "video" && lesson.video_duration_seconds) return formatClock(lesson.video_duration_seconds);
  if (lesson.kind === "pdf" && lesson.pdf_page_count) return `${lesson.pdf_page_count} p.`;
  if (lesson.estimated_minutes) return `${lesson.estimated_minutes} min`;
  return null;
}

function moduleMinutes(m: OutlineModule) {
  return m.lessons.reduce((s, l) => s + (l.video_duration_seconds ? l.video_duration_seconds / 60 : (l.estimated_minutes ?? 0)), 0);
}

function LessonStatusIcon({ lesson }: { lesson: OutlineLesson }) {
  if (lesson.status === "completed") return <CircleCheck className="size-[18px] text-success-600" aria-label="Terminée" />;
  if (lesson.status === "in_progress")
    return <ProgressRing value={lesson.progress_ratio} size={18} label={`En cours, ${Math.round(lesson.progress_ratio * 100)} %`} />;
  return <Circle className="size-[18px] text-ink-300" aria-label="Non commencée" />;
}

export function Curriculum({
  courseId,
  modules,
  currentLessonId,
  currentQuizId,
  interactive = true,
  basePath,
}: {
  courseId: string;
  modules: OutlineModule[];
  currentLessonId?: string;
  currentQuizId?: string;
  /** When false, items are not links (e.g. institution read-only view). */
  interactive?: boolean;
  /** Defaults to the learner routes. */
  basePath?: string;
}) {
  const base = basePath ?? `/espace/formations/${courseId}`;
  // The course overview shows module descriptions; the player's side panel stays compact.
  const overview = !currentLessonId && !currentQuizId;
  const initiallyOpen = new Set(
    modules
      .filter(
        (m) =>
          m.lessons.some((l) => l.id === currentLessonId) ||
          m.quiz?.id === currentQuizId ||
          (overview && !m.completed),
      )
      .map((m) => m.id)
      .slice(0, overview ? 2 : 1),
  );
  const [open, setOpen] = useState<Set<string>>(initiallyOpen.size ? initiallyOpen : new Set(modules[0] ? [modules[0].id] : []));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ol className="space-y-3">
      {modules.map((m, mi) => {
        const isOpen = open.has(m.id);
        const done = m.lessons.filter((l) => l.status === "completed").length;
        const items = m.lessons.length + (m.quiz ? 1 : 0);
        const itemsDone = done + (m.quiz?.passed ? 1 : 0);
        const ratio = items ? itemsDone / items : 0;
        const started = itemsDone > 0 || m.lessons.some((l) => l.status === "in_progress");
        const panelId = `module-${m.id}`;
        const minutes = moduleMinutes(m);
        return (
          <li
            key={m.id}
            className={cn(
              "overflow-hidden rounded-xl border bg-surface transition-shadow",
              isOpen ? "border-line-strong shadow-sm" : "border-line hover:border-line-strong",
            )}
          >
            <h3>
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={cn("flex w-full items-center gap-4 text-left", overview ? "px-5 py-4" : "px-4 py-3")}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-lg font-semibold",
                    overview ? "size-10 text-body" : "size-8 text-caption",
                    m.completed
                      ? "bg-success-50 text-success-700 ring-1 ring-inset ring-success-600/20"
                      : started
                        ? "bg-accent-50 text-accent-800 ring-1 ring-inset ring-accent-100"
                        : "bg-ink-100 text-ink-600",
                  )}
                >
                  {m.completed ? <CircleCheck className="size-5" aria-label="Module validé" /> : String(mi + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  {overview ? <span className="block text-caption font-medium uppercase tracking-wider text-ink-500">Module {mi + 1}</span> : null}
                  <span className={cn("block font-semibold text-ink-900", overview ? "text-card" : "truncate text-body")}>{m.title}</span>
                  {overview && m.description ? <span className="mt-0.5 line-clamp-1 block text-label text-ink-500">{m.description}</span> : null}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
                    <span>
                      {done}/{m.lessons.length} leçon{m.lessons.length > 1 ? "s" : ""}
                    </span>
                    {minutes ? <span>{formatDuration(Math.round(minutes))}</span> : null}
                    {m.quiz ? <span>Évaluation {m.quiz.passed ? "réussie" : "à valider"}</span> : null}
                  </span>
                </span>
                {overview ? (
                  <span className="hidden w-28 shrink-0 sm:block">
                    <span className="mb-1 block text-right text-caption font-medium tabular text-ink-600">{Math.round(ratio * 100)} %</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className={cn("block h-full rounded-full", m.completed ? "bg-success-600" : "bg-accent-500")}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </span>
                  </span>
                ) : null}
                <ChevronDown className={cn("size-4 shrink-0 text-ink-400 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen} className="border-t border-line bg-ink-25/60">
              <ul className={cn("py-2", overview && "px-2")}>
                {m.lessons.map((lesson) => {
                  const current = lesson.id === currentLessonId;
                  const KindIcon = lesson.kind === "video" ? PlayCircle : FileText;
                  const content = (
                    <>
                      <LessonStatusIcon lesson={lesson} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-body",
                            current ? "font-semibold text-brand-800" : lesson.status === "completed" ? "text-ink-600" : "font-medium text-ink-800",
                          )}
                        >
                          {lesson.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-500">
                          <KindIcon className="size-3.5" aria-hidden />
                          {lesson.kind === "video" ? "Vidéo" : "Document"}
                          {!lesson.is_mandatory ? " · Facultative" : ""}
                        </span>
                      </span>
                      {lessonMeta(lesson) ? (
                        <span className="tabular shrink-0 self-center rounded-full bg-surface px-2 py-0.5 text-caption text-ink-500 ring-1 ring-inset ring-line">
                          {lessonMeta(lesson)}
                        </span>
                      ) : null}
                    </>
                  );
                  const row = "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors";
                  return (
                    <li key={lesson.id}>
                      {interactive ? (
                        <Link
                          href={`${base}/lecons/${lesson.id}`}
                          aria-current={current ? "page" : undefined}
                          className={cn(row, current ? "bg-brand-50 shadow-[inset_3px_0_0_var(--color-accent-500)]" : "hover:bg-surface hover:shadow-xs")}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className={row}>{content}</div>
                      )}
                    </li>
                  );
                })}
                {m.quiz ? <QuizRow quiz={m.quiz} href={`${base}/evaluations/${m.quiz.id}`} current={m.quiz.id === currentQuizId} interactive={interactive} /> : null}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QuizRow({ quiz, href, current, interactive }: { quiz: OutlineQuiz; href: string; current: boolean; interactive: boolean }) {
  const status = quizStatusLabel(quiz);
  const Icon = quiz.passed ? CircleCheck : quiz.exhausted ? TriangleAlert : quiz.unlocked ? ClipboardCheck : Lock;
  const content = (
    <>
      <span
        className={cn(
          "flex size-[26px] -ml-1 shrink-0 items-center justify-center rounded-md",
          status.tone === "success" && "bg-success-50 text-success-600",
          status.tone === "danger" && "bg-danger-50 text-danger-600",
          status.tone === "muted" && "bg-ink-100 text-ink-400",
          (status.tone === "accent" || status.tone === "warning") && "bg-accent-50 text-accent-700",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-body", current ? "font-semibold text-brand-800" : "font-medium text-ink-800")}>Évaluation du module</span>
        <span
          className={cn(
            "text-caption",
            status.tone === "success" && "text-success-700",
            status.tone === "danger" && "text-danger-600",
            status.tone === "warning" && "text-warning-700",
            (status.tone === "muted" || status.tone === "accent") && "text-ink-500",
          )}
        >
          {status.text}
        </span>
      </span>
      {!quiz.passed && quiz.unlocked && !quiz.exhausted ? (
        <span className="shrink-0 self-center rounded-full bg-accent-700 px-2.5 py-0.5 text-caption font-medium text-white">Passer</span>
      ) : null}
    </>
  );
  const row = "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors";
  return (
    <li className="mt-1 border-t border-dashed border-line pt-1">
      {interactive ? (
        <Link
          href={href}
          aria-current={current ? "page" : undefined}
          className={cn(row, current ? "bg-brand-50 shadow-[inset_3px_0_0_var(--color-accent-500)]" : "hover:bg-surface hover:shadow-xs")}
        >
          {content}
        </Link>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}
