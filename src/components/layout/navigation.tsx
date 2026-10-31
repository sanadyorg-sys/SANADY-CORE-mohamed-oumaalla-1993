"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Award,
  BookMarked,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Clapperboard,
  FilePenLine,
  HandCoins,
  Sprout,
  Wallet,
  ChartColumn,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Handshake,
  History,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  Package,
  Upload,
  Library,
  Mail,
  Megaphone,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
  Newspaper,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type Area = "teacher" | "institution" | "admin" | "partner";
/** admin area: admin | manager | trainer | partners | enterprise — institution area: admin | supervisor. */
export type NavRole = "admin" | "manager" | "trainer" | "partners" | "enterprise" | "supervisor";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}
interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Menus with more links than this fold their sections. */
const FOLD_ABOVE = 14;

const PARTNERSHIP_ITEMS: NavItem[] = [
  { href: "/admin/partenariats", label: "Candidatures", icon: Handshake, exact: true },
  { href: "/admin/partenariats/organisations", label: "Organisations partenaires", icon: Building },
  { href: "/admin/partenariats/besoins", label: "Besoins éducatifs", icon: ClipboardList },
  { href: "/admin/partenariats/opportunites", label: "Projets publiés", icon: Megaphone },
  { href: "/admin/partenariats/conventions", label: "Conventions", icon: FilePenLine },
  { href: "/admin/partenariats/contributions", label: "Contributions", icon: HandCoins },
  { href: "/admin/partenariats/impact", label: "Impact", icon: Sprout },
  { href: "/admin/partenariats/rapports", label: "Rapports aux partenaires", icon: FileText },
  { href: "/admin/partenariats/modeles", label: "Modèles de messages", icon: MessagesSquare },
];

const NEWS_ITEM: NavItem = { href: "/admin/actualites", label: "Actualités", icon: Newspaper };

const ENTERPRISE_ITEMS: NavItem[] = [
  { href: "/admin/partenariats/entreprises", label: "Demandes entreprises", icon: Inbox, exact: true },
  { href: "/admin/partenariats/entreprises/clients", label: "Clients et prospects", icon: Briefcase },
  { href: "/admin/partenariats/entreprises/propositions", label: "Propositions", icon: FileText },
  { href: "/admin/partenariats/entreprises/formules", label: "Formules de service", icon: Package },
  { href: "/admin/partenariats/entreprises/contrats", label: "Contrats", icon: FilePenLine },
  { href: "/admin/partenariats/entreprises/finances", label: "Finances", icon: Wallet },
  { href: "/admin/partenariats/entreprises/espaces", label: "Espaces de formation", icon: Building2 },
  { href: "/admin/partenariats/entreprises/assistance", label: "Assistance", icon: LifeBuoy },
  { href: "/admin/studio", label: "Studio de production", icon: Clapperboard },
];

/** Approvers from another team reach the enterprise pages where commitments are approved. */
const ENTERPRISE_APPROVAL_ITEMS: NavItem[] = ENTERPRISE_ITEMS.filter((i) =>
  ["/admin/partenariats/entreprises/propositions", "/admin/partenariats/entreprises/contrats", "/admin/partenariats/entreprises/finances"].includes(i.href),
);

export function navigationFor(area: Area, institutionId?: string, role: NavRole = "admin", enterprise = false, approver = false): NavSection[] {
  const sections = baseNavigation(area, institutionId, role, enterprise);
  if (area === "admin" && approver && role !== "admin" && role !== "enterprise") {
    return [...sections, { title: "Enterprise · approbations", items: ENTERPRISE_APPROVAL_ITEMS }];
  }
  return sections;
}

function baseNavigation(area: Area, institutionId: string | undefined, role: NavRole, enterprise: boolean): NavSection[] {
  if (area === "admin" && role === "enterprise") {
    return [{ title: "SANADY Enterprise", items: ENTERPRISE_ITEMS }];
  }
  if (area === "admin" && role === "partners") {
    return [
      { title: "Partenariats", items: PARTNERSHIP_ITEMS },
      { title: "Communication", items: [NEWS_ITEM] },
    ];
  }
  if (area === "admin" && role === "trainer") {
    return [
      {
        items: [
          { href: "/admin/formations", label: "Mes formations", icon: Library },
          { href: "/admin/studio", label: "Studio : mes tâches", icon: Clapperboard },
        ],
      },
    ];
  }
  if (area === "admin" && role === "manager") {
    return [
      { items: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true }] },
      {
        title: "Pédagogie",
        items: [
          { href: "/admin/formations", label: "Formations", icon: Library },
          { href: "/admin/studio", label: "Studio de production", icon: Clapperboard },
          { href: "/admin/bibliotheque", label: "Bibliothèque", icon: BookMarked },
          { href: "/admin/suivi", label: "Suivi pédagogique", icon: ChartColumn },
          { href: "/admin/rapports", label: "Rapports et statistiques", icon: ChartNoAxesCombined },
          { href: "/admin/certificats", label: "Certificats", icon: Award },
        ],
      },
      { title: "Communication", items: [NEWS_ITEM] },
    ];
  }
  if (area === "admin") {
    return [
      { items: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true }] },
      {
        title: "Pédagogie",
        items: [
          { href: "/admin/formations", label: "Formations", icon: Library },
          { href: "/admin/bibliotheque", label: "Bibliothèque", icon: BookMarked },
          { href: "/admin/suivi", label: "Suivi pédagogique", icon: ChartColumn },
          { href: "/admin/rapports", label: "Rapports et statistiques", icon: ChartNoAxesCombined },
          { href: "/admin/certificats", label: "Certificats", icon: Award },
        ],
      },
      { title: "Communication", items: [NEWS_ITEM] },
      {
        title: "Organisation",
        items: [
          { href: "/admin/etablissements", label: "Établissements", icon: Building2 },
          { href: "/admin/enseignants", label: "Gestion des enseignants", icon: Users },
          { href: "/admin/demandes", label: "Demandes d’accès", icon: Inbox },
          { href: "/admin/invitations", label: "Invitations", icon: Mail },
        ],
      },
      { title: "Partenariats", items: PARTNERSHIP_ITEMS },
      { title: "SANADY Enterprise", items: ENTERPRISE_ITEMS },
      {
        title: "Plateforme",
        items: [
          { href: "/admin/journal", label: "Journal d’activité", icon: History },
          { href: "/admin/administrateurs", label: "Équipe SANADY", icon: ShieldCheck },
          { href: "/admin/parametres", label: "Paramètres", icon: Settings },
        ],
      },
    ];
  }
  if (area === "institution" && institutionId) {
    const base = `/etablissement/${institutionId}`;
    return [
      {
        items: [
          { href: base, label: "Tableau de bord", icon: LayoutDashboard, exact: true },
          { href: `${base}/enseignants`, label: enterprise ? "Nos collaborateurs" : "Nos enseignants", icon: Users },
          ...(enterprise && role === "admin"
            ? [
                { href: `${base}/services`, label: "Services", icon: Building },
                { href: `${base}/projets`, label: "Formations sur mesure", icon: Clapperboard },
                { href: `${base}/assistance`, label: "Assistance", icon: LifeBuoy },
              ]
            : []),
          { href: `${base}/formations`, label: "Formations autorisées", icon: Library },
          { href: `${base}/suivi`, label: "Suivi individuel", icon: ClipboardList },
          { href: `${base}/statistiques`, label: "Statistiques", icon: ChartNoAxesCombined },
          { href: `${base}/rapports`, label: "Rapports", icon: FileText },
          ...(enterprise ? [] : [{ href: "/espace/bibliotheque", label: "Bibliothèque", icon: BookMarked }]),
          ...(enterprise ? [] : [{ href: "/actualites", label: "Actualités", icon: Newspaper }]),
        ],
      },
    ];
  }
  if (area === "partner") {
    return [
      {
        items: [
          { href: "/espace-partenaire", label: "Notre partenariat", icon: LayoutDashboard, exact: true },
          { href: "/espace-partenaire/rapports", label: "Rapports", icon: FileText },
          { href: "/espace-partenaire/livrables", label: "Livrables", icon: Upload },
          { href: "/espace-partenaire/messages", label: "Échanges avec SANADY", icon: MessagesSquare },
        ],
      },
    ];
  }
  return [
    {
      items: [
        { href: "/espace", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
        { href: "/espace/formations", label: "Mes formations", icon: BookOpen },
        { href: "/espace/evaluations", label: "Mes évaluations", icon: ClipboardCheck },
        { href: "/espace/certificats", label: enterprise ? "Mes attestations" : "Mes certificats", icon: Award },
        ...(enterprise ? [] : [{ href: "/espace/bibliotheque", label: "Bibliothèque", icon: BookMarked }]),
        ...(enterprise ? [] : [{ href: "/actualites", label: "Actualités", icon: Newspaper }]),
        { href: "/espace/profil", label: "Mon profil", icon: UserRound },
      ],
    },
  ];
}

export function SidebarNav({
  area,
  institutionId,
  role,
  enterprise,
  approver,
  onNavigate,
}: {
  area: Area;
  institutionId?: string;
  role?: NavRole;
  enterprise?: boolean;
  approver?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = navigationFor(area, institutionId, role, enterprise, approver);
  // Long menus (the administrators' one) fold their sections; the current section opens by itself.
  const foldable = sections.reduce((n, section) => n + section.items.length, 0) > FOLD_ABOVE;
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav aria-label="Navigation principale" className={foldable ? "space-y-1" : "space-y-6"}>
      {sections.map((section, i) => {
        const canFold = foldable && Boolean(section.title) && section.items.length > 1;
        const hasActive = section.items.some(isActive);
        const open = !canFold || (toggled[section.title!] ?? hasActive);
        return (
          <div key={i} className={foldable && i > 0 && !canFold ? "pt-2" : undefined}>
            {canFold ? (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setToggled((t) => ({ ...t, [section.title!]: !open }))}
                className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-caption font-semibold uppercase tracking-wider text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800"
              >
                <span className="truncate">{section.title}</span>
                {!open && hasActive ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-500" /> : null}
                <ChevronDown className={cn("ml-auto size-3.5 shrink-0 transition-transform duration-200", open ? "rotate-180" : "")} aria-hidden />
              </button>
            ) : section.title ? (
              <p className="mb-1.5 px-3 text-caption font-semibold uppercase tracking-wider text-ink-400">{section.title}</p>
            ) : null}
            {open ? (
              <ul className={cn("space-y-0.5", canFold && "pb-2 pt-0.5")}>
                {section.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex h-9 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
                          active ? "bg-accent-50 text-ink-900 shadow-[inset_3px_0_0_var(--color-accent-500)]" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                        )}
                      >
                        <Icon
                          className={cn("size-[1.0625rem] shrink-0", active ? "text-accent-600" : "text-ink-400 group-hover:text-ink-600")}
                          aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
