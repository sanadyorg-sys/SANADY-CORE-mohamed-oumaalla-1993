import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CircleCheck,
  ClipboardCheck,
  Clock,
  FileText,
  Lock,
  PlayCircle,
  Signal,
  Target,
  Users,
} from "lucide-react";
import { ActivityList } from "@/components/learning/activity-list";
import { CourseCover, PercentRing } from "@/components/learning/course-card";
import { Curriculum } from "@/components/learning/curriculum";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { coverUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth";
import { getCourseOutline, getLearnerCourses, getRecentActivity } from "@/server/queries/learning";

export async function generateMetadata(props: PageProps<"/espace/formations/[courseId]">): Promise<Metadata> {
  const { courseId } = await props.params;
  const course = (await getLearnerCourses()).find((c) => c.course_id === courseId);
  return { title: course?.title ?? "Formation" };
}

export default async function CourseOverviewPage(props: PageProps<"/espace/formations/[courseId]">) {
  const { courseId } = await props.params;
  const viewer = await requireViewer();

  const enrollment = (await getLearnerCourses()).find((c) => c.course_id === courseId);
  if (!enrollment) notFound();

  if (!enrollment.has_access) {
    return (
      <>
        <BackLink />
        <h1 className="text-title font-semibold text-ink-900">{enrollment.title}</h1>
        <Alert tone="warning" title="Formation momentanément indisponible" className="mt-6 max-w-2xl">
          L’accès à cette formation a été suspendu (formation dépubliée, autorisation retirée ou fin d’affiliation à votre
          établissement). Votre progression est conservée.
          {enrollment.certificate_id ? (
            <>
              {" "}
              Votre certificat reste disponible dans <Link href="/espace/certificats">Mes certificats</Link>.
            </>
          ) : null}
        </Alert>
      </>
    );
  }

  let outline = await getCourseOutline(courseId, viewer.id);
  if (!outline) notFound();

  // Self-heal completion if the curriculum changed after the learner finished.
  const { totals } = outline;
  if (!enrollment.certificate_id && totals.mandatory > 0 && totals.completed === totals.mandatory && totals.quizzesPassed === totals.quizzes && totals.quizzes > 0) {
    const supabase = await createClient();
    const { data: issued } = await supabase.rpc("refresh_course_completion", { p_course: courseId });
    if (issued) outline = (await getCourseOutline(courseId, viewer.id)) ?? outline;
  }

  const activity = await getRecentActivity(viewer.id, { courseId, limit: 6 });
  const { course, modules } = outline;
  const steps = totals.mandatory + totals.quizzes;
  const ratio = steps ? (totals.completed + totals.quizzesPassed) / steps : 0;
  const completed = enrollment.enrollment_status === "completed";
  const resumeHref = enrollment.resume_lesson_id ? `/espace/formations/${courseId}/lecons/${enrollment.resume_lesson_id}` : null;
  const pendingQuiz = modules.map((m) => m.quiz).find((q) => q && !q.passed && q.unlocked && !q.exhausted);
  const lessons = modules.flatMap((m) => m.lessons);
  const videos = lessons.filter((l) => l.kind === "video").length;
  const documents = lessons.length - videos;
  const nextLesson = lessons.find((l) => l.id === enrollment.resume_lesson_id);
  const nextModule = modules.find((m) => m.lessons.some((l) => l.id === enrollment.resume_lesson_id));
  const cover = coverUrl(course.cover_path);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate mb-10 overflow-hidden rounded-2xl bg-brand-800 text-white shadow-pop">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- public bucket URL, decorative backdrop
          <img src={cover} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45" />
        ) : null}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-900 via-brand-900/85 to-brand-900/40" />
        <div aria-hidden className="bg-dots-light absolute inset-0 -z-10 opacity-60" />

        <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-10">
          <div className="min-w-0">
            <Link href="/espace/formations" className="mb-6 inline-flex items-center gap-1.5 text-label font-medium text-white/70 hover:text-white">
              <ArrowLeft className="size-4" aria-hidden /> Mes formations
            </Link>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {course.category ? <HeroChip>{course.category}</HeroChip> : null}
              <HeroChip>
                <Signal className="size-3.5" aria-hidden /> {COURSE_LEVELS[course.level]}
              </HeroChip>
              {completed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-600 px-3 py-1 text-caption font-semibold text-white">
                  <CircleCheck className="size-3.5" aria-hidden /> Terminée
                </span>
              ) : null}
            </div>
            <h1 className="max-w-3xl text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.375rem]">{course.title}</h1>
            {course.summary ? <p className="mt-3 max-w-2xl text-reading text-white/80">{course.summary}</p> : null}

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-label text-white/80">
              <li className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-accent-400" aria-hidden /> {formatDuration(course.estimated_minutes)}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4 text-accent-400" aria-hidden /> {modules.length} module{modules.length > 1 ? "s" : ""}
              </li>
              {videos ? (
                <li className="inline-flex items-center gap-1.5">
                  <PlayCircle className="size-4 text-accent-400" aria-hidden /> {videos} vidéo{videos > 1 ? "s" : ""}
                </li>
              ) : null}
              {documents ? (
                <li className="inline-flex items-center gap-1.5">
                  <FileText className="size-4 text-accent-400" aria-hidden /> {documents} document{documents > 1 ? "s" : ""}
                </li>
              ) : null}
              {course.target_audience ? (
                <li className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-accent-400" aria-hidden /> {course.target_audience}
                </li>
              ) : null}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {completed ? (
                <Link href="/espace/certificats" className={buttonClasses({ variant: "brand", size: "lg" })}>
                  <Award aria-hidden /> Voir mon certificat
                </Link>
              ) : resumeHref ? (
                <Link href={resumeHref} className={buttonClasses({ variant: "brand", size: "lg", className: "btn-sheen font-semibold" })}>
                  {enrollment.started_at ? "Reprendre ma formation" : "Commencer la formation"} <ArrowRight aria-hidden />
                </Link>
              ) : pendingQuiz ? (
                <Link href={`/espace/formations/${courseId}/evaluations/${pendingQuiz.id}`} className={buttonClasses({ variant: "brand", size: "lg", className: "btn-sheen font-semibold" })}>
                  Passer l’évaluation <ArrowRight aria-hidden />
                </Link>
              ) : null}
              <a href="#programme" className="inline-flex h-11 items-center rounded-md px-4 text-[0.9375rem] font-medium text-white/85 ring-1 ring-inset ring-white/25 hover:bg-white/10 hover:text-white">
                Voir le programme
              </a>
            </div>
          </div>

          {/* Progress panel */}
          <div className="self-end rounded-xl bg-white p-5 text-ink-800 shadow-pop">
            <div className="flex items-center gap-4">
              <PercentRing value={ratio} size={76} stroke={7} tone={completed ? "success" : "accent"} label={`Progression : ${Math.round(ratio * 100)} %`} />
              <div className="min-w-0">
                <p className="text-card font-semibold text-ink-900">Ma progression</p>
                <p className="text-caption text-ink-500">
                  {completed ? `Terminée le ${formatDate(enrollment.completed_at)}` : `Inscrit(e) le ${formatDate(enrollment.enrolled_at)}`}
                </p>
              </div>
            </div>
            <dl className="mt-5 space-y-3 border-t border-line pt-4 text-label">
              <ProgressRow icon={BookOpen} label="Leçons obligatoires" done={totals.completed} total={totals.mandatory} />
              <ProgressRow icon={ClipboardCheck} label="Évaluations réussies" done={totals.quizzesPassed} total={totals.quizzes} />
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink-600">
                  <Award className="size-4 text-ink-400" aria-hidden /> Certificat
                </dt>
                <dd>
                  {enrollment.certificate_number ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-success-700">
                      <CircleCheck className="size-4" aria-hidden /> Obtenu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-ink-500">
                      <Lock className="size-3.5" aria-hidden /> À obtenir
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {nextLesson && !completed ? (
              <Link href={resumeHref!} className="mt-4 flex items-start gap-3 rounded-lg bg-accent-50 p-3 ring-1 ring-inset ring-accent-100 hover:bg-accent-100/70">
                {nextLesson.kind === "video" ? <PlayCircle className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden /> : <FileText className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden />}
                <span className="min-w-0">
                  <span className="block text-caption font-medium text-accent-800">À suivre{nextModule ? ` · Module ${nextModule.position}` : ""}</span>
                  <span className="block truncate text-label font-semibold text-ink-900">{nextLesson.title}</span>
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {course.objectives.length ? (
            <section aria-labelledby="objectifs">
              <h2 id="objectifs" className="mb-4 text-title font-semibold text-ink-900">
                Ce que vous allez apprendre
              </h2>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {course.objectives.map((o, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-body text-ink-700 shadow-xs">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100">
                      <Target className="size-4" aria-hidden />
                    </span>
                    <span className="self-center">{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="programme" aria-labelledby="programme-titre" className="scroll-mt-20">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 id="programme-titre" className="text-title font-semibold text-ink-900">
                Programme
              </h2>
              <p className="text-label text-ink-500">
                {modules.length} module{modules.length > 1 ? "s" : ""} · {lessons.length} leçon{lessons.length > 1 ? "s" : ""} · {totals.quizzes} évaluation
                {totals.quizzes > 1 ? "s" : ""}
              </p>
            </div>
            <Curriculum courseId={courseId} modules={modules} />
          </section>

          {course.description ? (
            <section aria-labelledby="presentation">
              <h2 id="presentation" className="mb-4 text-title font-semibold text-ink-900">
                Présentation
              </h2>
              <div className="max-w-3xl whitespace-pre-line text-reading text-ink-700">{course.description}</div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden">
            <CourseCover path={course.cover_path} title={course.title} category={course.category} className="aspect-[16/9]" />
            <CardBody className="space-y-3 text-label text-ink-600">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 text-ink-400" aria-hidden /> Inscrit(e) le {formatDate(enrollment.enrolled_at)}
              </p>
              {enrollment.completed_at ? (
                <p className="flex items-center gap-2">
                  <CircleCheck className="size-4 text-success-600" aria-hidden /> Terminée le {formatDate(enrollment.completed_at)}
                </p>
              ) : null}
              <p className="flex items-start gap-2">
                <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                <span>Chaque module se valide par une évaluation : 70 % pour réussir, 3 tentatives.</span>
              </p>
              <p className="flex items-start gap-2">
                <Award className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                <span>Certificat délivré automatiquement à la fin de la formation.</span>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Activité récente" />
            <CardBody>
              {activity.length ? (
                <ActivityList items={activity} showCourse={false} />
              ) : (
                <p className="text-body text-ink-500">Aucune activité pour le moment.</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function HeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-caption font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur">
      {children}
    </span>
  );
}

function ProgressRow({ icon: Icon, label, done, total }: { icon: React.ComponentType<{ className?: string }>; label: string; done: number; total: number }) {
  const full = total > 0 && done === total;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-2 text-ink-600">
          <Icon className="size-4 text-ink-400" aria-hidden /> {label}
        </dt>
        <dd className="tabular font-semibold text-ink-900">
          {done}
          <span className="font-normal text-ink-400">/{total}</span>
        </dd>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className={cn("h-full rounded-full", full ? "bg-success-600" : "bg-accent-500")} style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/espace/formations" className="mb-5 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
      <ArrowLeft className="size-4" aria-hidden /> Mes formations
    </Link>
  );
}
