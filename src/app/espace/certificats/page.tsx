import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, Download, ExternalLink, Lock, QrCode, Sparkles } from "lucide-react";
import { PercentRing } from "@/components/learning/course-card";
import { SpaceHeader } from "@/components/learning/space-header";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card } from "@/components/ui/surface";
import { publicEnv } from "@/lib/env";
import { formatDate, formatDuration } from "@/lib/format";
import { requireViewer } from "@/server/auth";
import { getCertificates, getLearnerCourses } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Mes certificats" };

export default async function CertificatesPage() {
  const viewer = await requireViewer();
  const [certificates, courses] = await Promise.all([getCertificates(viewer.id), getLearnerCourses()]);
  const valid = certificates.filter((c) => !c.revoked_at);
  // Courses still on their way to a certificate, closest first.
  const onTheWay = courses
    .filter((c) => c.has_access && c.enrollment_status === "active")
    .map((c) => {
      const parts = c.mandatory_lessons + c.quizzes_total;
      return { course: c, ratio: parts ? (c.completed_lessons + c.quizzes_passed) / parts : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);

  return (
    <>
      <SpaceHeader
        icon={Award}
        title="Mes certificats et attestations"
        description="Chaque certificat atteste votre réussite et comporte un code QR cryptographique et un identifiant unique vérifiables par les académies et établissements."
        stats={[
          { icon: Award, label: "Certificats obtenus", value: valid.length },
          { icon: Lock, label: "En préparation", value: onTheWay.length },
        ]}
      />
      {certificates.length === 0 ? (
        onTheWay.length ? (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="p-6 sm:p-8">
                <h2 className="text-section font-semibold text-ink-900">En route vers votre premier certificat</h2>
                <p className="mt-1 max-w-xl text-body text-ink-600">
                  Il est délivré automatiquement dès que toutes les leçons obligatoires d’une formation sont terminées et toutes ses évaluations
                  réussies (70 % minimum).
                </p>
                <ul className="mt-6 space-y-3">
                  {onTheWay.map(({ course: c, ratio }) => (
                    <li key={c.course_id}>
                      <Link
                        href={`/espace/formations/${c.course_id}`}
                        className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-sm"
                      >
                        <PercentRing value={ratio} size={52} stroke={5} label={`Progression vers le certificat : ${c.title}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-semibold text-ink-900">{c.title}</span>
                          <span className="block text-caption text-ink-500">
                            {c.completed_lessons}/{c.mandatory_lessons} leçons · {c.quizzes_passed}/{c.quizzes_total} évaluations réussies
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {/* What the certificate will look like. */}
              <div aria-hidden className="relative hidden items-center justify-center overflow-hidden bg-ink-25 p-8 lg:flex">
                <div className="bg-zellige-rosette-accent absolute inset-0 opacity-[0.12]" />
                <div className="relative w-full max-w-60 rotate-[-2deg] rounded-lg bg-surface p-5 text-center shadow-pop ring-1 ring-line">
                  <div className="mx-auto h-1.5 w-full rounded-full bg-gradient-to-r from-accent-500 via-amber-500 to-accent-600" />
                  <Award className="mx-auto mt-4 size-8 text-accent-600" />
                  <p className="mt-2 text-caption font-semibold uppercase tracking-wider text-ink-500">Certificat</p>
                  <div className="mx-auto mt-3 h-2 w-3/4 rounded-full bg-ink-100" />
                  <div className="mx-auto mt-2 h-2 w-1/2 rounded-full bg-ink-100" />
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[0.625rem] text-ink-400">Fondation Sanady</span>
                    <QrCode className="size-6 text-ink-300" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={Award}
              title="Aucun certificat pour le moment"
              description="Un certificat est délivré automatiquement dès que toutes les leçons obligatoires d’une formation sont achevées et que l'ensemble des quiz sont validés avec succès (score minimal de 70 %)."
            />
          </Card>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {certificates.map((c) => {
            const verifyUrl = `${publicEnv.appUrl}/verifier/${c.verification_code}`;
            const completionDate = c.completed_at ? new Date(c.completed_at) : new Date();
            const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
              c.course_title,
            )}&organizationName=${encodeURIComponent("Fondation Sanady")}&issueYear=${completionDate.getFullYear()}&issueMonth=${
              completionDate.getMonth() + 1
            }&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(c.certificate_number)}`;

            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col overflow-hidden border border-line shadow-sm hover:shadow-md transition-shadow duration-200">
                  {/* Decorative Diploma Accent Header */}
                  <div className="h-2 w-full bg-gradient-to-r from-accent-500 via-amber-500 to-accent-600" />

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-200 shadow-sm">
                        <Award className="size-6" aria-hidden />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          {c.revoked_at ? (
                            <Badge tone="danger">Révoqué</Badge>
                          ) : (
                            <Badge tone="success" dot>
                              Authentique
                            </Badge>
                          )}
                          <span className="font-mono text-caption text-ink-500 font-medium">
                            {c.certificate_number}
                          </span>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold text-ink-900 leading-snug">
                          {c.course_title}
                        </h2>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-600">
                          <span>Achevée le <strong className="font-semibold text-ink-800">{formatDate(c.completed_at)}</strong></span>
                          <span aria-hidden className="text-line-strong">•</span>
                          <span>Durée <strong className="font-semibold text-ink-800">{formatDuration(c.course_duration_minutes)}</strong></span>
                          <span aria-hidden className="text-line-strong">•</span>
                          <span className="inline-flex items-center gap-1 text-success-700 font-medium text-xs">
                            <CheckCircle2 className="size-3.5" aria-hidden /> Score ≥ 70 %
                          </span>
                        </div>
                      </div>
                    </div>

                    {c.revoked_at ? (
                      <p className="mt-4 rounded-lg bg-danger-50 p-3 text-label text-danger-800">
                        Révoqué le {formatDate(c.revoked_at)}
                        {c.revoke_reason ? ` — ${c.revoke_reason}` : ""}.
                      </p>
                    ) : (
                      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
                        <a
                          href={`/api/certificats/${c.id}`}
                          className={buttonClasses({ size: "sm", variant: "primary", className: "gap-1.5 shadow-sm" })}
                        >
                          <Download className="size-4" aria-hidden /> Télécharger (PDF)
                        </a>

                        <a
                          href={linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClasses({
                            size: "sm",
                            variant: "secondary",
                            className: "gap-1.5 text-[#0A66C2] hover:text-[#084e96]",
                          })}
                        >
                          <Sparkles className="size-3.5" aria-hidden /> Partager sur LinkedIn
                        </a>

                        <CopyButton value={verifyUrl} label="Copier le lien" copiedLabel="Lien copié !" />

                        <a
                          href={verifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonClasses({ variant: "ghost", size: "sm", className: "gap-1.5" })}
                        >
                          <ExternalLink className="size-3.5" aria-hidden /> Page publique
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
