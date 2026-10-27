"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Briefcase, Building2, CheckCircle2, GraduationCap, Handshake, type LucideIcon } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * « Pour qui ? » — one panel per audience the platform actually serves
 * (teacher space, institution space, partnerships, SANADY Enterprise).
 * Wording comes from the existing pages (/partenariats, /partenariats/entreprises).
 */
interface Audience {
  key: string;
  icon: LucideIcon;
  label: string;
  title: string;
  points: string[];
  cta: { href: string; label: string };
  secondary?: { href: string; label: string };
}

const AUDIENCES: Audience[] = [
  {
    key: "enseignants",
    icon: GraduationCap,
    label: "Enseignants",
    title: "Se former à son rythme, et voir ses acquis reconnus",
    points: [
      "Des formations courtes : vidéos et documents pensés pour la classe",
      "Une évaluation à la fin de chaque module, avec des explications",
      "Un certificat délivré par la Fondation, vérifiable par QR code",
    ],
    cta: { href: "/demande-acces", label: "Demander un accès" },
    secondary: { href: "/formations", label: "Voir les formations" },
  },
  {
    key: "etablissements",
    icon: Building2,
    label: "Établissements",
    title: "Accompagner la formation de toute votre équipe",
    points: [
      "Invitez vos enseignants par e-mail ou avec un code d’établissement",
      "Affectez les formations adaptées à vos objectifs annuels",
      "Suivez la progression et téléchargez des bilans en PDF",
    ],
    cta: { href: "/demande-acces?profil=etablissement", label: "Inscrire mon établissement" },
  },
  {
    key: "partenaires",
    icon: Handshake,
    label: "Partenaires",
    title: "Agir ensemble pour l’école publique",
    points: [
      "Entreprises, universités, fondations et organisations peuvent s’engager",
      "Financement, expertise, équipement ou coopération : chacun apporte quelque chose",
      "Chaque partenariat est validé par la Fondation et formalisé par une convention",
    ],
    cta: { href: "/partenariats", label: "Proposer un partenariat" },
  },
  {
    key: "entreprises",
    icon: Briefcase,
    label: "Entreprises",
    title: "Former vos équipes avec l’expertise de la Fondation",
    points: [
      "Un parcours sur mesure : besoins, contenus, évaluations et attestations",
      "Un espace de formation privé, séparé de la plateforme SANADY",
      "Le suivi par collaborateur et des exports pour vos équipes RH",
    ],
    cta: { href: "/partenariats/entreprises", label: "Découvrir l’offre entreprises" },
  },
];

export function AudienceSection() {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = AUDIENCES[active]!;

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? AUDIENCES.length - 1 : (i + delta + AUDIENCES.length) % AUDIENCES.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section aria-labelledby="pour-qui" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
          <BrandDots /> Pour qui ?
        </p>
        <h2 id="pour-qui" className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
          Une plateforme, quatre façons d’agir pour l’école
        </h2>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div role="tablist" aria-label="Publics" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {AUDIENCES.map((a, i) => {
            const selected = i === active;
            return (
              <button
                key={a.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                id={`tab-${a.key}`}
                aria-selected={selected}
                aria-controls={`panel-${a.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "group flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-300",
                  selected ? "border-brand-800 bg-brand-800 text-white shadow-lg" : "border-line bg-surface text-ink-800 hover:border-line-strong hover:bg-ink-25",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    selected ? "bg-accent-500 text-white" : "bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100",
                  )}
                >
                  <a.icon className="size-5" aria-hidden />
                </span>
                <span className="text-card font-bold">{a.label}</span>
                <ArrowRight className={cn("ml-auto hidden size-4 transition-all lg:block", selected ? "text-accent-400" : "text-ink-300 group-hover:translate-x-0.5")} aria-hidden />
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${current.key}`}
          aria-labelledby={`tab-${current.key}`}
          tabIndex={0}
          className="relative isolate overflow-hidden rounded-[2rem] rounded-tl-md border border-line bg-ink-25 p-7 sm:p-10"
        >
          <div aria-hidden className="bg-zellige absolute inset-y-0 right-0 -z-10 w-1/2 opacity-70 [mask-image:linear-gradient(to_left,black,transparent)]" />
          <div aria-hidden className="absolute -bottom-20 -right-20 -z-10 size-72 rounded-full bg-accent-500/10 blur-3xl" />
          <div key={current.key} className="audience-panel max-w-2xl">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-lg">
              <current.icon className="size-7" aria-hidden />
            </span>
            <h3 className="mt-6 text-[1.5rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[1.875rem]">{current.title}</h3>
            <ul className="mt-6 space-y-3.5">
              {current.points.map((p) => (
                <li key={p} className="flex gap-3 text-body text-ink-700 sm:text-reading">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={current.cta.href} className={buttonClasses({ variant: "accent", size: "lg", className: "rounded-xl" })}>
                {current.cta.label} <ArrowRight aria-hidden />
              </Link>
              {current.secondary ? (
                <Link href={current.secondary.href} className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
                  {current.secondary.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
