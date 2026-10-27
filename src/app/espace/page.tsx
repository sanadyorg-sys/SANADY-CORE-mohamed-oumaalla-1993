import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Inbox,
  Lock,
  PlayCircle,
} from "lucide-react";
import { ActivityList } from "@/components/learning/activity-list";
import { CourseCover, LearnerCourseCard, PercentRing } from "@/components/learning/course-card";
import { KIND_ICONS } from "@/components/library/library-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader, SectionHeading } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative, formatScore } from "@/lib/format";
import { LIBRARY_KINDS } from "@/lib/labels";
import { todayInMorocco } from "@/lib/period";
import { requireViewer } from "@/server/auth";
import {
  getAttempts,
  getCertificates,
  getLearnerCourses,
  getNextSteps,
  getRecentActivity,
  type LearnerCourse,
  type NextStep,
} from "@/server/queries/learning";
import { libraryHighlights } from "@/server/queries/library";

export const metadata: Metadata = { title: "Tableau de bord" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Casablanca" }).format(new Date()));
  return hour >= 18 || hour < 4 ? "Bonsoir" : "Bonjour";
}

const DAY = 86_400_000;

/** Days until a due date (negative when overdue), in Morocco's calendar. */
function daysUntil(due: string, today: string) {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

function DueBadge({ due, today }: { due: string; today: string }) {
  const days = daysUntil(due, today);
  if (days < 0) return <Badge tone="danger">Échéance dépassée ({formatDate(due)})</Badge>;
  if (days <= 7) return <Badge tone="warning">À terminer avant le {formatDate(due)}</Badge>;
  return <Badge tone="neutral">Échéance : {formatDate(due)}</Badge>;
}

function stepHref(step: NextStep) {
  const base = `/espace/formations/${step.course_id}`;
  if (step.step_kind === "lesson" && step.lesson_id) return `${base}/lecons/${step.lesson_id}`;
  if (step.quiz_id) return `${base}/evaluations/${step.quiz_id}`;
  return base;
}

const STEP_LABEL: Record<NextStep["step_kind"], string> = {
  lesson: "Leçon suivante",
  quiz: "Évaluation disponible",
  blocked: "Évaluation à débloquer",
};

export default async function TeacherDashboardPage() {
  const viewer = await requireViewer();
  const [courses, steps, activity, certificates, attempts] = await Promise.all([
    getLearnerCourses(),
    getNextSteps(),
    getRecentActivity(viewer.id, { limit: 6 }),
    getCertificates(viewer.id),
    getAttempts(viewer.id),
  ]);
  const library = await libraryHighlights(courses.map((c) => c.course_id));
  const today = todayInMorocco();

  const accessible = courses.filter((c) => c.has_access);
  const active = accessible.filter((c) => c.enrollment_status === "active");
  const completed = courses.filter((c) => c.enrollment_status === "completed");
  const quizzesPassed = courses.reduce((sum, c) => sum + c.quizzes_passed, 0);
  const validCertificates = certificates.filter((c) => !c.revoked_at);
  const recentResults = attempts.filter((a) => a.status === "submitted" && !a.voided_at).slice(0, 3);
  const lessonsDone = active.reduce((s, c) => s + c.completed_lessons, 0);
  const lessonsTotal = active.reduce((s, c) => s + c.mandatory_lessons, 0);
  const coursesById = new Map(courses.map((c) => [c.course_id, c]));
  const [next, ...later] = steps;
  const deadlines = steps.filter((s) => s.due_on).slice(0, 4);
  // Most recently worked on first.
  const activeSorted = [...active].sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""));

  return (
    <>
      {/* ─── Welcome banner ──────────────────────────────────────────────── */}
      <section className="relative isolate mb-8 overflow-hidden rounded-2xl bg-brand-800 text-white shadow-pop">
        <div aria-hidden className="bg-dots-light absolute inset-0 -z-10" />
        <div aria-hidden className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-accent-500/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 left-1/3 -z-10 size-72 rounded-full bg-accent-600/10 blur-3xl" />

        <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
          <div className="min-w-0 max-w-xl">
            <p className="text-label text-white/60">{formatDate(new Date())}</p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight">
              {greeting()}, {viewer.profile.first_name || "et bienvenue"}
            </h1>
            <p className="mt-2 text-reading text-white/75">
              {active.length
                ? `Vous avez ${active.length} formation${active.length > 1 ? "s" : ""} en cours. Chaque leçon compte : continuez à votre rythme.`
                : "Bienvenue dans votre espace de formation SANADY."}
            </p>
            {next ? (
              <Link href={stepHref(next)} className={buttonClasses({ variant: "brand", size: "lg", className: "btn-sheen mt-6 font-semibold" })}>
                {next.step_kind === "lesson" ? "Continuer mon apprentissage" : next.step_kind === "quiz" ? "Passer l’évaluation" : "Revoir la formation"} <ArrowRight aria-hidden />
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {lessonsTotal > 0 ? (
              <div className="flex items-center gap-4">
                <PercentRing value={lessonsDone / lessonsTotal} size={104} stroke={9} invert label="Progression globale des leçons obligatoires" />
                <div>
                  <p className="text-caption uppercase tracking-wider text-white/60">Progression globale</p>
                  <p className="tabular text-section font-semibold">
                    {lessonsDone}/{lessonsTotal} leçons
                  </p>
                  <p className="text-caption text-white/60">obligatoires terminées</p>
                </div>
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-3 sm:w-64">
              <HeroStat icon={BookOpen} label="En cours" value={active.length} />
              <HeroStat icon={CircleCheck} label="Terminées" value={completed.length} />
              <HeroStat icon={ClipboardCheck} label="Évaluations" value={quizzesPassed} />
              <HeroStat icon={Award} label="Certificats" value={validCertificates.length} />
            </dl>
          </div>
        </div>
      </section>

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="Aucune formation ne vous est encore attribuée"
            description="Les formations vous sont attribuées par l’équipe SANADY ou par votre établissement. Elles apparaîtront ici dès leur affectation."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/rejoindre" className={buttonClasses({ variant: "secondary" })}>
                  J’ai un code d’établissement
                </Link>
                <Link href="/espace/bibliotheque" className={buttonClasses({ variant: "ghost" })}>
                  Explorer la bibliothèque
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            {next ? (
              <NextStepCard step={next} course={coursesById.get(next.course_id)} today={today} />
            ) : active.length === 0 ? null : (
              <Card>
                <EmptyState compact icon={CircleCheck} title="Rien d’urgent" description="Vos formations en cours sont à jour." />
              </Card>
            )}

            <section>
              <SectionHeading
                title="Mes formations en cours"
                description="Reprenez où vous vous êtes arrêté(e)"
                actions={
                  <Link href="/espace/formations" className="inline-flex items-center gap-1 text-label font-medium text-accent-700 hover:underline">
                    Toutes mes formations <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                }
              />
              {active.length ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {activeSorted.slice(0, 4).map((c) => (
                    <LearnerCourseCard key={c.course_id} course={c} />
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    compact
                    icon={CircleCheck}
                    title="Toutes vos formations sont terminées"
                    description="Retrouvez vos certificats dans la rubrique dédiée."
                  />
                </Card>
              )}
            </section>

            <section>
              <SectionHeading title="Historique d’apprentissage" description="Vos dernières actions sur la plateforme" />
              <Card>
                <CardBody className="py-5">
                  {activity.length ? (
                    <ActivityList items={activity} />
                  ) : (
                    <p className="text-body text-ink-500">Votre activité d’apprentissage apparaîtra ici.</p>
                  )}
                </CardBody>
              </Card>
            </section>
          </div>

          <aside className="space-y-6">
            {deadlines.length ? (
              <Card>
                <CardHeader title="Échéances" description="À ne pas manquer" />
                <CardBody>
                  <ul className="space-y-3">
                    {deadlines.map((s) => {
                      const days = daysUntil(s.due_on!, today);
                      const late = days < 0;
                      const soon = days <= 7;
                      return (
                        <li key={s.course_id}>
                          <Link href={stepHref(s)} className="group flex items-center gap-3">
                            <span
                              className={cn(
                                "flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 ring-1 ring-inset",
                                late ? "bg-danger-50 text-danger-700 ring-danger-200" : soon ? "bg-warning-50 text-warning-700 ring-warning-200" : "bg-ink-50 text-ink-700 ring-line",
                              )}
                            >
                              <span className="tabular text-card font-semibold leading-none">{new Date(`${s.due_on}T12:00:00Z`).getUTCDate()}</span>
                              <span className="mt-0.5 text-[0.625rem] font-medium uppercase">
                                {new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(`${s.due_on}T12:00:00Z`))}
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-body font-medium text-ink-900 group-hover:underline">{s.course_title}</span>
                              <span className={cn("block text-caption", late ? "text-danger-600" : soon ? "text-warning-700" : "text-ink-500")}>
                                {late ? `En retard de ${-days} jour${-days > 1 ? "s" : ""}` : days === 0 ? "Aujourd’hui" : `Dans ${days} jour${days > 1 ? "s" : ""}`}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            ) : null}

            {later.length ? (
              <Card>
                <CardHeader title="Ensuite" description="La prochaine étape de vos autres formations" />
                <CardBody>
                  <ul className="space-y-4">
                    {later.slice(0, 4).map((s) => (
                      <li key={s.course_id}>
                        <Link href={stepHref(s)} className="group flex items-start gap-3">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100">
                            {s.step_kind === "lesson" ? <PlayCircle className="size-4" aria-hidden /> : <ClipboardCheck className="size-4" aria-hidden />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-caption font-medium text-ink-500">{s.course_title}</span>
                            <span className="block text-body font-medium text-ink-900 group-hover:underline">{s.item_title}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader
                title="Dernières évaluations"
                actions={
                  recentResults.length ? (
                    <Link href="/espace/evaluations" className="text-label font-medium text-accent-700 hover:underline">
                      Voir tout
                    </Link>
                  ) : null
                }
              />
              <CardBody>
                {recentResults.length ? (
                  <ul className="space-y-4">
                    {recentResults.map((a) => (
                      <li key={a.id}>
                        <Link href={`/espace/formations/${a.course_id}/evaluations/${a.quiz_id}/resultats/${a.id}`} className="group block">
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate text-body font-medium text-ink-800 group-hover:underline">{a.quiz?.title}</span>
                              <span className="block text-caption text-ink-500">
                                Tentative {a.attempt_number} · {formatRelative(a.submitted_at)}
                              </span>
                            </span>
                            <Badge tone={a.passed ? "success" : "neutral"}>{a.passed ? "Réussie" : "Non validée"}</Badge>
                          </span>
                          <span className="mt-2 flex items-center gap-3">
                            <ProgressBar value={Number(a.score_percent ?? 0) / 100} label="Score" size="sm" tone={a.passed ? "success" : "accent"} className="flex-1" />
                            <span className="tabular w-14 text-right text-label font-semibold text-ink-900">{formatScore(a.score_percent)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-ink-500">Chaque module se termine par une évaluation : 70 % pour la valider, trois tentatives.</p>
                )}
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="Mes certificats"
                actions={
                  validCertificates.length ? (
                    <Link href="/espace/certificats" className="text-label font-medium text-accent-700 hover:underline">
                      Voir tout
                    </Link>
                  ) : null
                }
              />
              <CardBody>
                {validCertificates.length ? (
                  <ul className="space-y-3">
                    {validCertificates.slice(0, 3).map((c) => (
                      <li key={c.id} className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-accent-50 to-transparent p-3 ring-1 ring-inset ring-accent-100">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white shadow-xs">
                          <Award className="size-[18px]" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-body font-semibold text-ink-900">{c.course_title}</p>
                          <p className="text-caption text-ink-500">Délivré le {formatDate(c.issued_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-ink-500">
                    Un certificat est délivré automatiquement lorsque toutes les leçons obligatoires sont terminées et toutes les évaluations
                    réussies.
                  </p>
                )}
              </CardBody>
            </Card>

            {library.length ? (
              <Card>
                <CardHeader
                  title="Bibliothèque pédagogique"
                  actions={
                    <Link href="/espace/bibliotheque" className="text-label font-medium text-accent-700 hover:underline">
                      Explorer
                    </Link>
                  }
                />
                <CardBody>
                  <ul className="space-y-3">
                    {library.map((r) => {
                      const Icon = KIND_ICONS[r.kind] ?? BookMarked;
                      return (
                        <li key={r.id}>
                          <Link href={`/espace/bibliotheque/${r.id}`} className="group flex items-start gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-accent-700 ring-1 ring-inset ring-line">
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-body font-medium text-ink-800 group-hover:underline">{r.title}</span>
                              <span className="block text-caption text-ink-500">
                                {LIBRARY_KINDS[r.kind]}
                                {r.course ? ` · ${r.course.title}` : ""}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}

function HeroStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-3.5 py-3 ring-1 ring-inset ring-white/10 backdrop-blur">
      <dt className="flex items-center gap-1.5 text-caption text-white/60">
        <Icon className="size-3.5 text-accent-400" aria-hidden /> {label}
      </dt>
      <dd className="tabular mt-1 text-title font-semibold leading-none">{value}</dd>
    </div>
  );
}

function NextStepCard({ step, course, today }: { step: NextStep; course?: LearnerCourse; today: string }) {
  const href = stepHref(step);
  const Icon = step.step_kind === "lesson" ? PlayCircle : step.step_kind === "quiz" ? ClipboardCheck : Lock;
  const ratio = course && course.mandatory_lessons ? course.completed_lessons / course.mandatory_lessons : 0;
  return (
    <section aria-labelledby="prochaine-etape" className="group relative overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="relative hidden overflow-hidden md:block">
          <CourseCover path={course?.cover_path ?? null} title={step.course_title} category={course?.category} className="h-full min-h-[200px]" imageClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-transparent to-brand-900/15" />
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div className="min-w-0">
            <p id="prochaine-etape" className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-accent-700">
              <span className="live-radar" aria-hidden /> Ma prochaine étape
            </p>
            <h2 className="mt-1.5 text-section font-semibold text-ink-900">{step.course_title}</h2>
            <div className="mt-3 flex items-start gap-3 rounded-lg bg-ink-25 p-3 ring-1 ring-inset ring-line">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", step.step_kind === "blocked" ? "bg-ink-100 text-ink-500" : "bg-accent-50 text-accent-700")}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 text-body text-ink-800">
                <span className="font-medium">{STEP_LABEL[step.step_kind]} :</span> {step.item_title}
                <span className="block text-caption text-ink-500">
                  Module {step.module_position} — {step.module_title}
                  {step.step_kind === "quiz" && step.attempts_used > 0
                    ? ` · ${step.max_attempts - step.attempts_used} tentative${step.max_attempts - step.attempts_used > 1 ? "s" : ""} restante${step.max_attempts - step.attempts_used > 1 ? "s" : ""}`
                    : ""}
                </span>
              </span>
            </div>
            {step.step_kind === "blocked" ? (
              <p className="mt-3 max-w-xl text-label text-ink-600">
                Vous avez utilisé vos {step.max_attempts} tentatives. Un administrateur SANADY peut les réinitialiser après un échange avec vous :
                revoyez les leçons du module en attendant.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {step.due_on ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4 text-ink-400" aria-hidden />
                  <DueBadge due={step.due_on} today={today} />
                </span>
              ) : null}
              {course ? (
                <div className="w-full max-w-xs">
                  <ProgressBar value={ratio} label="Progression des leçons de cette formation" size="sm" showValue />
                </div>
              ) : null}
            </div>
          </div>
          <Link href={href} className={buttonClasses({ size: "lg", variant: step.step_kind === "blocked" ? "secondary" : "primary", className: "self-start" })}>
            {step.step_kind === "lesson" ? (
              <>
                {course?.started_at ? "Continuer" : "Commencer"} <ArrowRight aria-hidden />
              </>
            ) : step.step_kind === "quiz" ? (
              <>
                Passer l’évaluation <ArrowRight aria-hidden />
              </>
            ) : (
              <>
                <FileText aria-hidden /> Revoir la formation
              </>
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}
