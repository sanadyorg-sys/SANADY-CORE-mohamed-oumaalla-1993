import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Mail, Newspaper, Plus, Star, Tags } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FilterSelect, SearchForm } from "@/components/ui/search-form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Pagination, TBody, TD, TH, THead, TR, Table, withParams } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { NEWS_STATUS_LABELS, NEWS_STATUS_TONES, NEWS_VISIBILITY_LABELS, newsDisplayStatus, type NewsDisplayStatus } from "@/lib/news";
import { requireStaff } from "@/server/auth";
import { ADMIN_NEWS_PAGE_SIZE, getNewsCategories, getNewsViewTotals, listAdminNews } from "@/server/queries/news";

export const metadata: Metadata = { title: "Actualités" };

const STATUSES: NewsDisplayStatus[] = ["draft", "scheduled", "published", "archived"];

export default async function AdminNewsPage(props: PageProps<"/admin/actualites">) {
  const viewer = await requireStaff(["admin", "manager", "partners"]);
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const statut = STATUSES.find((s) => s === one(sp.statut));
  const q = one(sp.q)?.slice(0, 100);
  const categorie = one(sp.categorie);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [{ items, total }, categories] = await Promise.all([listAdminNews({ q, status: statut, category: categorie, page }), getNewsCategories()]);
  const views = await getNewsViewTotals(items.map((i) => i.id));
  const tab = (s?: string) => withParams("/admin/actualites", { statut: s });

  return (
    <>
      <PageHeader
        title="Actualités"
        description="Annonces, nouvelles formations, événements et témoignages publiés sur la page Actualités, pour le public ou pour certains membres."
        actions={
          <>
            {viewer.isSanadyAdmin ? (
              <Link href="/admin/actualites/categories" className={buttonClasses({ variant: "secondary" })}>
                <Tags aria-hidden /> Catégories
              </Link>
            ) : null}
            <Link href="/actualites" className={buttonClasses({ variant: "ghost" })}>
              <Eye aria-hidden /> Voir la page publique
            </Link>
            <Link href="/admin/actualites/nouvelle" className={buttonClasses()}>
              <Plus aria-hidden /> Nouvel article
            </Link>
          </>
        }
      />
      {sp.supprime ? (
        <Alert tone="success" className="mb-6">
          Le brouillon a été supprimé.
        </Alert>
      ) : null}
      {!viewer.isSanadyAdmin ? (
        <Alert tone="info" className="mb-6">
          Vous pouvez rédiger et modifier des brouillons. Un administrateur SANADY les relit, puis les publie ou les programme.
        </Alert>
      ) : null}
      <LinkTabs
        className="mb-6"
        activeHref={tab(statut)}
        items={[{ href: tab(), label: "Tous" }, ...STATUSES.map((s) => ({ href: tab(s), label: NEWS_STATUS_LABELS[s] }))]}
      />
      <Card>
        <div className="border-b border-line px-5 py-4">
          <SearchForm action="/admin/actualites" defaultValue={q} placeholder="Rechercher un article">
            {statut ? <input type="hidden" name="statut" value={statut} /> : null}
            <FilterSelect
              name="categorie"
              label="Catégorie"
              defaultValue={categorie}
              options={[{ value: "", label: "Toutes les catégories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </SearchForm>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={q || statut || categorie ? "Aucun article ne correspond" : "Aucun article pour l’instant"}
            description="Rédigez une annonce, présentez une nouvelle formation ou un événement à venir."
          />
        ) : (
          <Table caption="Articles d’actualité">
            <THead>
              <TR>
                <TH>Article</TH>
                <TH>Public</TH>
                <TH>Statut</TH>
                <TH>Publication</TH>
                <TH className="text-right">Vues</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((a) => {
                const status = newsDisplayStatus(a);
                return (
                  <TR key={a.id}>
                    <TD className="min-w-72">
                      <Link href={`/admin/actualites/${a.id}`} className="font-medium text-ink-900 hover:underline">
                        {a.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-2 text-caption text-ink-500">
                        {a.category?.name ?? <span className="text-warning-700">Sans catégorie</span>}
                        {a.author ? (
                          <span>
                            · {a.author.first_name} {a.author.last_name}
                          </span>
                        ) : null}
                        {a.featured ? (
                          <span className="inline-flex items-center gap-0.5 font-medium text-accent-700">
                            · <Star className="size-3" aria-hidden /> À la une
                          </span>
                        ) : null}
                        {a.notify_email ? (
                          <span className="inline-flex items-center gap-0.5">
                            · <Mail className="size-3" aria-hidden /> {a.notified_at ? "E-mail envoyé" : "E-mail prévu"}
                          </span>
                        ) : null}
                      </p>
                    </TD>
                    <TD className="text-label text-ink-600">{NEWS_VISIBILITY_LABELS[a.visibility]}</TD>
                    <TD>
                      <Badge tone={NEWS_STATUS_TONES[status]} dot>
                        {NEWS_STATUS_LABELS[status]}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-label text-ink-600">{a.published_at && a.status !== "draft" ? formatDateTime(a.published_at) : "—"}</TD>
                    <TD className="tabular text-right text-label text-ink-700">{formatNumber(views.get(a.id) ?? 0)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
      <div className="mt-6">
        <Pagination page={page} pageSize={ADMIN_NEWS_PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/actualites", { statut, q, categorie, page: p })} />
      </div>
    </>
  );
}
