import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, CalendarClock, ClipboardList, FilePenLine, Inbox, LifeBuoy, ListChecks, RefreshCw, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { EMPLOYEE_COUNTS, ENTERPRISE_SERVICES, REQUEST_STATUS, type RequestStatus } from "@/lib/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { runHousekeeping } from "@/server/housekeeping";
import { enterpriseWatchlist, listClients, listProposals, listRequests, openEnterpriseTasks, requestCounts } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "SANADY Enterprise — demandes" };

/** One line of the « À surveiller » panel: what, how urgent, and where to act. */
function WatchRow({ href, icon: Icon, tone = "warning", title, detail }: { href: string; icon: LucideIcon; tone?: "warning" | "danger" | "neutral"; title: string; detail?: string }) {
  const tones = { warning: "bg-warning-50 text-warning-700", danger: "bg-danger-50 text-danger-700", neutral: "bg-ink-100 text-ink-600" };
  return (
    <li>
      <Link href={href} className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-ink-25">
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium text-ink-900 group-hover:text-accent-700">{title}</span>
          {detail ? <span className={`block text-caption ${tone === "danger" ? "font-semibold text-danger-600" : "text-ink-500"}`}>{detail}</span> : null}
        </span>
        <ArrowRight className="mt-2 size-4 shrink-0 -translate-x-1 text-accent-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
      </Link>
    </li>
  );
}

const TABS: Record<string, { label: string; status: RequestStatus | "open" }> = {
  ouvertes: { label: "À traiter", status: "open" },
  clients: { label: "Clients créés", status: "converted" },
  "non-retenues": { label: "Non retenues", status: "declined" },
  retirees: { label: "Retirées", status: "withdrawn" },
  indesirables: { label: "Indésirables", status: "spam" },
};

export default async function EnterpriseInboxPage(props: PageProps<"/admin/partenariats/entreprises">) {
  await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const tab = typeof sp.onglet === "string" && sp.onglet in TABS ? sp.onglet : "ouvertes";
  // Fallback for the daily job: readings, confirmed deletions due, retention purge.
  await runHousekeeping().catch((e) => console.error("[enterprise] housekeeping", e));
  const [rows, counts, tasks, clients, proposals, watch] = await Promise.all([
    listRequests({ status: TABS[tab]!.status }),
    requestCounts(),
    openEnterpriseTasks(),
    listClients({}),
    listProposals({}),
    enterpriseWatchlist(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const active = clients.filter((c) => c.enterprise_status === "active_service").length;
  const pending = proposals.filter((p) => ["draft", "internal_review", "approved", "sent"].includes(p.status)).length;

  return (
    <>
      <PageHeader
        icon={Briefcase}
        title="SANADY Enterprise"
        description="Les demandes de formation des organisations, de la première prise de contact au service actif."
        actions={
          <Link href="/admin/partenariats/entreprises/clients" className={buttonClasses({ variant: "secondary" })}>
            Clients et prospects
          </Link>
        }
      />
      <Alert tone="warning" title="Activité en projet" className="mb-6">
        Les services aux entreprises ne sont pas encore autorisés par la Fondation (statuts, fiscalité, comptabilité : voir docs/enterprise/plan.md). Aucune
        proposition ne doit être envoyée ni aucun contrat signé avant cette autorisation.
      </Alert>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Nouvelles demandes" value={counts.received ?? 0} icon={Inbox} highlight={(counts.received ?? 0) > 0} detail={counts.received ? "À examiner" : "Rien en attente"} />
        <StatTile label="Demandes qualifiées" value={counts.qualified ?? 0} icon={ListChecks} detail="Prêtes pour une proposition" />
        <StatTile label="Propositions en cours" value={pending} icon={FilePenLine} href="/admin/partenariats/entreprises/propositions" detail="Voir les propositions" />
        <StatTile label="Clients en service actif" value={active} icon={BadgeCheck} href="/admin/partenariats/entreprises/clients" detail="Voir les clients" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <LinkTabs
            className="mb-4"
            activeHref={`/admin/partenariats/entreprises?onglet=${tab}`}
            items={Object.entries(TABS).map(([k, t]) => ({
              href: `/admin/partenariats/entreprises?onglet=${k}`,
              label: t.label,
              count: k === "ouvertes" ? (counts.received ?? 0) + (counts.qualified ?? 0) : undefined,
            }))}
          />
          {rows.length === 0 ? (
            <Card>
              <EmptyState icon={Briefcase} title="Aucune demande" description="Les organisations décrivent leur besoin depuis la page SANADY Enterprise." />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table caption="Demandes entreprises">
                <THead>
                  <TR>
                    <TH>Organisation</TH>
                    <TH>Service</TH>
                    <TH>Besoin</TH>
                    <TH>Statut</TH>
                    <TH>Reçue</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-label font-semibold text-white">
                            {r.org_name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <Link href={`/admin/partenariats/entreprises/demandes/${r.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                              {r.org_name}
                            </Link>
                            <span className="block text-caption text-ink-500">
                              {r.reference} · {EMPLOYEE_COUNTS[r.employee_count as keyof typeof EMPLOYEE_COUNTS]} salariés
                            </span>
                          </div>
                        </div>
                      </TD>
                      <TD>{ENTERPRISE_SERVICES[r.service].short}</TD>
                      <TD>
                        {r.topic}
                        {r.learner_count ? <span className="block text-caption text-ink-500">{r.learner_count} apprenants</span> : null}
                      </TD>
                      <TD>
                        <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                      </TD>
                      <TD>
                        <span title={formatDateTime(r.created_at)}>{formatRelative(r.created_at)}</span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </div>
        <div className="space-y-6 self-start">
        {watch && (watch.renewals.length || watch.overages.length || watch.approvals || watch.support_waiting || watch.deletions.length) ? (
          <Card>
            <CardHeader title="À surveiller" />
            <ul className="divide-y divide-line">
              {watch.approvals ? (
                <WatchRow
                  href="/admin/partenariats/entreprises/contrats"
                  icon={ClipboardList}
                  title={`${watch.approvals} contrat${watch.approvals > 1 ? "s" : ""} à approuver`}
                  detail="En attente d’un approbateur"
                />
              ) : null}
              {watch.support_waiting ? (
                <WatchRow
                  href="/admin/partenariats/entreprises/assistance"
                  icon={LifeBuoy}
                  tone={watch.support_urgent ? "danger" : "warning"}
                  title={`Assistance : ${watch.support_waiting} demande${watch.support_waiting > 1 ? "s" : ""} à traiter`}
                  detail={watch.support_urgent ? `dont ${watch.support_urgent} urgente(s) sans réponse` : undefined}
                />
              ) : null}
              {watch.deletions.map((d) => (
                <WatchRow
                  key={`d-${d.tenant_id}`}
                  href={`/admin/partenariats/entreprises/espaces/${d.tenant_id}#suppression`}
                  icon={ShieldAlert}
                  tone={d.status === "confirmed" || d.due_on <= today ? "danger" : "warning"}
                  title={`Suppression des données : ${d.tenant}`}
                  detail={
                    d.on_hold
                      ? "Suspendue"
                      : d.status === "confirmed"
                        ? `Confirmée — exécution à partir du ${d.execute_after ? formatDate(d.execute_after) : "—"}`
                        : d.status === "proposed"
                          ? `Proposée — date prévue le ${formatDate(d.due_on)}`
                          : d.due_on <= today
                            ? `Date prévue dépassée (${formatDate(d.due_on)}) : à proposer ou reporter`
                            : `Prévue le ${formatDate(d.due_on)} : prévenir l’organisation`
                  }
                />
              ))}
              {watch.renewals.map((r) => (
                <WatchRow key={`r-${r.id}`} href={`/admin/partenariats/entreprises/contrats/${r.id}`} icon={RefreshCw} title={`Renouvellement : ${r.title}`} detail={`${r.organization} · fin le ${formatDate(r.end_on)}`} />
              ))}
              {watch.overages.map((o) => (
                <WatchRow
                  key={`o-${o.id}`}
                  href={`/admin/partenariats/entreprises/espaces/${o.tenant_id}#utilisation`}
                  icon={TriangleAlert}
                  tone="danger"
                  title={`Dépassement à examiner : ${o.tenant}`}
                  detail={`Relevé de ${new Date(o.period).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`}
                />
              ))}
            </ul>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Tâches de suivi" />
          {tasks.length ? (
            <ul className="divide-y divide-line">
              {tasks.map((t) => {
                const late = t.due_on && t.due_on < today;
                return (
                  <li key={t.id}>
                    <Link href={`/admin/partenariats/entreprises/clients/${t.organization_id}`} className="group block px-5 py-3 transition-colors hover:bg-ink-25">
                      <span className="block text-body font-medium text-ink-900 group-hover:text-accent-700">{t.title}</span>
                      <span className="block text-caption text-ink-500">{t.organization?.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-500">
                        {t.due_on ? (
                          <span className={late ? "inline-flex items-center gap-1 rounded-md bg-danger-50 px-1.5 py-0.5 font-semibold text-danger-700" : "inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 font-medium text-ink-700"}>
                            <CalendarClock className="size-3.5" aria-hidden /> {late ? "En retard — " : ""}
                            {formatDate(t.due_on)}
                          </span>
                        ) : null}
                        {t.assignee ? <span>{displayName(t.assignee)}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-4 text-body text-ink-600">Aucune tâche ouverte.</p>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
