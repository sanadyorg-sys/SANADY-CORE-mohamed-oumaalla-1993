import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  HeartHandshake,
  LayoutDashboard,
  MessageSquareText,
  MonitorSmartphone,
  PlayCircle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { Highlight, InView } from "@/components/site/effects";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import classroom from "../../../public/brand/photos/accompagnement-eleve.jpg";
import poster from "../../../public/brand/photos/atelier-enseignants.jpg";
import teacher from "../../../public/brand/photos/atelier-numerique.jpg";

const POINTS = [
  { icon: PlayCircle, title: "Reprenez là où vous en étiez", text: "Votre prochaine leçon vous attend dès la connexion, sur ordinateur comme sur téléphone." },
  { icon: TrendingUp, title: "Visualisez votre progression", text: "Leçons, évaluations et échéances : tout est réuni sur un seul tableau de bord." },
  { icon: Award, title: "Valorisez vos acquis", text: "Vos certificats sont délivrés automatiquement et vérifiables par QR code." },
];

const COMMITMENTS = [
  { icon: MonitorSmartphone, title: "Sur tous vos appareils", text: "Ordinateur, tablette ou téléphone." },
  { icon: MessageSquareText, title: "Évaluations expliquées", text: "Chaque réponse est corrigée et commentée." },
  { icon: ShieldCheck, title: "Données protégées", text: "Vos formations personnelles restent privées." },
  { icon: HeartHandshake, title: "Porté par la Fondation", text: "Au service de l’école publique depuis 2009." },
];

/** Illustrative miniature of the teacher dashboard (decorative, labelled « Aperçu »). */
function DashboardMock() {
  const courses = [
    { title: "Évaluation formative en classe", img: classroom, pct: 40 },
    { title: "Gestion de classe bienveillante", img: poster, pct: 67 },
    { title: "Le numérique au service des apprentissages", img: teacher, pct: 12 },
  ];
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-surface text-ink-900 shadow-2xl ring-1 ring-black/10">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-ink-50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 flex-1 truncate rounded-md bg-surface px-3 py-1 text-caption text-ink-500 ring-1 ring-line">sanady · Espace enseignant</span>
      </div>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="space-y-1 border-r border-line bg-surface p-2 sm:p-3">
          {[
            { icon: LayoutDashboard, label: "Tableau de bord", active: true },
            { icon: BookOpen, label: "Mes formations" },
            { icon: ClipboardCheck, label: "Évaluations" },
            { icon: Award, label: "Certificats" },
          ].map((n) => (
            <div key={n.label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.6875rem] font-medium ${n.active ? "bg-accent-50 text-ink-900" : "text-ink-500"}`}>
              <n.icon className={`size-3.5 shrink-0 ${n.active ? "text-accent-600" : ""}`} />
              <span className="hidden truncate sm:inline">{n.label}</span>
            </div>
          ))}
        </div>
        {/* Content */}
        <div className="space-y-3 bg-ink-50 p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-xl bg-brand-800 p-3.5 text-white sm:p-4">
            <div className="absolute -right-8 -top-8 size-28 rounded-full bg-accent-500/30 blur-2xl" />
            <p className="text-[0.625rem] text-white/60">Mon tableau de bord</p>
            <p className="text-card font-bold">Bonjour, Salma</p>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="relative size-11 shrink-0">
                <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
                  <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" className="stroke-white/15" />
                  <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="grow-ring stroke-accent-500" style={{ strokeDashoffset: 0.5 }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[0.625rem] font-bold">50%</span>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-1.5">
                {[["4", "En cours"], ["5", "Évaluations"], ["1", "Certificat"]].map(([v, l], i) => (
                  <div key={l} className="pop-in rounded-md bg-white/10 px-2 py-1" style={{ "--i": i + 1 } as React.CSSProperties}>
                    <p className="text-label font-bold leading-tight">{v}</p>
                    <p className="truncate text-[0.5625rem] text-white/60">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="pop-in flex items-center gap-2 rounded-lg bg-surface p-2.5 ring-1 ring-line" style={{ "--i": 4 } as React.CSSProperties}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-700">
              <CalendarClock className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-accent-700">Ma prochaine étape</p>
              <p className="truncate text-[0.6875rem] font-medium">Donner une rétroaction efficace</p>
            </div>
            <span className="rounded-md bg-brand-700 px-2 py-1 text-[0.625rem] font-semibold text-white">Continuer</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {courses.map((c, i) => (
              <div
                key={c.title}
                className={`pop-in overflow-hidden rounded-lg bg-surface ring-1 ring-line ${i === 2 ? "hidden sm:block" : ""}`}
                style={{ "--i": i + 5 } as React.CSSProperties}
              >
                <div className="relative aspect-[16/9]">
                  <Image src={c.img} alt="" fill sizes="160px" className="object-cover" />
                </div>
                <div className="p-2">
                  <p className="line-clamp-1 text-[0.625rem] font-semibold">{c.title}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-100">
                    <div className="grow-bar h-full rounded-full bg-accent-500" style={{ width: `${c.pct}%`, "--i": i + 5 } as React.CSSProperties} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** « Votre espace enseignant » — shows the product, not just describes it. */
export function PlatformShowcase() {
  return (
    <section className="relative isolate overflow-hidden py-16 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-accent-50)_55%,var(--color-surface)_100%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8">
        <Reveal from="left">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Votre espace enseignant
          </p>
          <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
            Tout votre parcours, <Highlight>en un coup d’œil</Highlight>
          </h2>
          <p className="mt-4 max-w-lg text-reading leading-relaxed text-ink-600">
            Un tableau de bord clair qui vous guide de leçon en leçon, jusqu’au certificat.
          </p>
          <ul className="mt-8 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface text-accent-700 shadow-sm ring-1 ring-inset ring-accent-100">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-card font-bold text-ink-900">{p.title}</span>
                  <span className="mt-0.5 block text-body leading-relaxed text-ink-600">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/demande-acces" className={buttonClasses({ variant: "accent", size: "lg", className: "mt-9 rounded-xl" })}>
            Demander un accès <ArrowRight aria-hidden />
          </Link>
        </Reveal>

        <Reveal from="right" delay={120} className="relative">
          <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-accent-200/60 via-accent-100/40 to-transparent blur-2xl" />
          <InView threshold={0.3} className="lg:rotate-[1.2deg] lg:transition-transform lg:duration-700 lg:hover:rotate-0">
            <DashboardMock />
          </InView>
          <div aria-hidden className="animate-float absolute -bottom-6 -left-3 hidden items-center gap-3 rounded-2xl bg-surface p-3 pr-4 shadow-2xl ring-1 ring-line sm:flex">
            <span className="flex size-9 items-center justify-center rounded-full bg-success-50 text-success-700">
              <ClipboardCheck className="size-4" />
            </span>
            <span>
              <span className="block text-label font-bold text-ink-900">Évaluation réussie</span>
              <span className="block text-caption text-ink-500">Module 1 · 85 %</span>
            </span>
          </div>
          <p className="mt-10 text-center text-caption text-ink-500">Aperçu de l’espace enseignant</p>
        </Reveal>
      </div>

      {/* Commitments, in one slim row (formerly « Pourquoi SANADY »). */}
      <div className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal as="ul" from="stagger" className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {COMMITMENTS.map((c) => (
            <li key={c.title} className="flex items-start gap-3 bg-surface p-5">
              <c.icon className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
              <span>
                <span className="block text-body font-bold text-ink-900">{c.title}</span>
                <span className="mt-0.5 block text-label leading-snug text-ink-600">{c.text}</span>
              </span>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
