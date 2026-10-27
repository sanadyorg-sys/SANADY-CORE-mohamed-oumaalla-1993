import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Eye, Plus } from "lucide-react";
import { LessonContentEditor, LessonDetailsForm, ResourcesEditor } from "@/components/admin/lesson-editor";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { LESSON_KINDS } from "@/lib/labels";
import { serverEnv } from "@/lib/server-env";
import { requireStaff } from "@/server/auth";
import { getLessonEditorData } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Leçon" };

export default async function LessonEditorPage(props: PageProps<"/admin/formations/[courseId]/programme/lecons/[lessonId]">) {
  const { courseId, lessonId } = await props.params;
  await requireStaff();
  const data = await getLessonEditorData(lessonId);
  if (!data || data.lesson.course_id !== courseId || data.lesson.archived_at) notFound();
  const { lesson, resources, quiz } = data;
  const base = `/admin/formations/${courseId}`;
  const hasContent = Boolean(lesson.video_ref || lesson.pdf_path);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`${base}/programme`} className="inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden /> Programme{lesson.module ? ` · ${lesson.module.title}` : ""}
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{LESSON_KINDS[lesson.kind]}</Badge>
          {hasContent ? (
            <Link href={`${base}/apercu/lecons/${lesson.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Eye aria-hidden /> Aperçu enseignant
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="self-start">
          <CardHeader title="Détails de la leçon" />
          <CardBody>
            <LessonDetailsForm lesson={lesson} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contenu" description="Les fichiers sont stockés de manière privée et diffusés par liens temporaires aux seuls enseignants autorisés." />
            <CardBody>
              <LessonContentEditor lesson={lesson} muxConfigured={Boolean(serverEnv.mux)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Ressources complémentaires" description="Documents téléchargeables proposés sous la leçon." />
            <CardBody>
              <ResourcesEditor lesson={lesson} resources={resources} />
            </CardBody>
          </Card>
          {quiz ? (
            <Card className={quiz.questionCount === 0 ? "border-warning-200 bg-warning-50/60" : undefined}>
              <CardBody className="flex flex-wrap items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <ClipboardCheck className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-card font-semibold text-ink-900">Évaluation du module</p>
                  <p className={quiz.questionCount === 0 ? "text-label font-medium text-warning-700" : "text-label text-ink-600"}>
                    {quiz.questionCount === 0
                      ? "Aucune question pour l’instant : ajoutez-en au moins une pour pouvoir soumettre la formation."
                      : `${quiz.questionCount} question${quiz.questionCount > 1 ? "s" : ""} — proposée après les leçons du module.`}
                  </p>
                </div>
                <Link
                  href={`${base}/programme/evaluations/${quiz.id}`}
                  className={buttonClasses({ variant: quiz.questionCount === 0 ? "accent" : "secondary", size: "sm" })}
                >
                  {quiz.questionCount === 0 ? (
                    <>
                      <Plus aria-hidden /> Ajouter des questions
                    </>
                  ) : (
                    "Gérer les questions"
                  )}
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
