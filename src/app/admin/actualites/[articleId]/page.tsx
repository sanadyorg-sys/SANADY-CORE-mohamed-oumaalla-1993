import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye } from "lucide-react";
import { NewsArticleForm, NewsCoverPanel, NewsPublishPanel } from "@/components/admin/news-forms";
import { ActionButton } from "@/components/common/action-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDateTime, formatNumber } from "@/lib/format";
import { NEWS_STATUS_LABELS, NEWS_STATUS_TONES, NEWS_VISIBILITY_LABELS, newsDisplayStatus } from "@/lib/news";
import { uuidSchema } from "@/lib/validation";
import { deleteNewsArticle } from "@/server/actions/news";
import { requireStaff } from "@/server/auth";
import { getAdminNewsArticle, getNewsCategories, getNewsStats, newsFormOptions } from "@/server/queries/news";

export const metadata: Metadata = { title: "Article d’actualité" };

export default async function EditNewsArticlePage(props: PageProps<"/admin/actualites/[articleId]">) {
  const viewer = await requireStaff(["admin", "manager", "partners"]);
  const [{ articleId }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!uuidSchema.safeParse(articleId).success) notFound();
  const [article, categories, options, stats] = await Promise.all([
    getAdminNewsArticle(articleId),
    getNewsCategories(),
    newsFormOptions(),
    getNewsStats(articleId),
  ]);
  if (!article) notFound();
  const status = newsDisplayStatus(article);
  const canPublish = viewer.isSanadyAdmin;
  const missing = [
    !article.category_id && "une catégorie",
    article.excerpt.trim().length < 20 && "une introduction",
    article.body.trim().length < 50 && "le texte de l’article",
  ].filter(Boolean) as string[];

  return (
    <>
      <Link href="/admin/actualites" className="mb-4 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Actualités
      </Link>
      <PageHeader
        title={article.title}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={NEWS_STATUS_TONES[status]} dot>
              {NEWS_STATUS_LABELS[status]}
            </Badge>
            <Badge>{NEWS_VISIBILITY_LABELS[article.visibility]}</Badge>
          </span>
        }
        actions={
          <>
            <Link href={`/actualites/${article.slug}?apercu=1`} target="_blank" className={buttonClasses({ variant: "secondary" })}>
              <Eye aria-hidden /> Aperçu
            </Link>
            {status === "published" ? (
              <Link href={`/actualites/${article.slug}`} target="_blank" className={buttonClasses({ variant: "ghost" })}>
                <ExternalLink aria-hidden /> Voir en ligne
              </Link>
            ) : null}
          </>
        }
      />

      {sp.cree ? (
        <Alert tone="success" className="mb-6" title="Brouillon créé">
          Ajoutez maintenant une image de couverture et, si besoin, des images dans le texte.
        </Alert>
      ) : null}
      {missing.length && article.status === "draft" ? (
        <Alert tone="warning" className="mb-6" title="Avant de publier">
          Il manque {missing.join(", ")}.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardBody>
            <NewsArticleForm article={article} categories={categories} {...options} canPublish={canPublish} />
          </CardBody>
        </Card>
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader title="Publication" />
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-label">
                <dt className="text-ink-500">Statut</dt>
                <dd className="font-medium text-ink-900">{NEWS_STATUS_LABELS[status]}</dd>
                {article.published_at && article.status !== "draft" ? (
                  <>
                    <dt className="text-ink-500">{status === "scheduled" ? "Prévue le" : "Publiée le"}</dt>
                    <dd className="text-ink-900">{formatDateTime(article.published_at)}</dd>
                  </>
                ) : null}
                <dt className="text-ink-500">Modifiée le</dt>
                <dd className="text-ink-900">{formatDateTime(article.updated_at)}</dd>
                {article.notify_email ? (
                  <>
                    <dt className="text-ink-500">E-mail</dt>
                    <dd className="text-ink-900">{article.notified_at ? `envoyé le ${formatDateTime(article.notified_at)}` : status === "scheduled" ? "à l’heure de publication" : "à la publication"}</dd>
                  </>
                ) : null}
              </dl>
              <NewsPublishPanel article={article} canPublish={canPublish} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Image de couverture" />
            <CardBody>
              <NewsCoverPanel article={article} />
            </CardBody>
          </Card>
          {article.status !== "draft" || stats.total.views ? (
            <Card>
              <CardHeader title="Lecture" description="Totaux quotidiens, sans suivi individuel des lecteurs." />
              <CardBody>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Vues", stats.total.views, stats.recent.views],
                    ["Clics formation", stats.total.course, stats.recent.course],
                    ["Inscriptions", stats.total.event, stats.recent.event],
                  ].map(([label, total, recent]) => (
                    <div key={label as string} className="rounded-lg bg-ink-25 p-3">
                      <dt className="text-caption text-ink-500">{label}</dt>
                      <dd className="tabular text-section font-semibold text-ink-900">{formatNumber(total as number)}</dd>
                      <dd className="tabular text-caption text-ink-500">{formatNumber(recent as number)} en 30 j</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-caption text-ink-500">Une même connexion est comptée une fois par demi-heure. « Inscriptions » = clics vers le lien d’inscription.</p>
              </CardBody>
            </Card>
          ) : null}
          {canPublish && article.status === "draft" && !article.published_at ? (
            <Card>
              <CardHeader title="Suppression" />
              <CardBody>
                <ActionButton
                  action={deleteNewsArticle.bind(null, article.id)}
                  variant="danger-ghost"
                  confirm={{
                    title: "Supprimer définitivement ce brouillon ?",
                    description: "Le brouillon et ses images seront supprimés. Cette action est irréversible.",
                    confirmLabel: "Supprimer",
                    tone: "danger",
                  }}
                >
                  Supprimer le brouillon
                </ActionButton>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
