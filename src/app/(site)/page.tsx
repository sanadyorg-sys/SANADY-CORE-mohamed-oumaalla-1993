import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Laptop,
  Mail,
  PlayCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { AudienceSection } from "@/components/site/audience-section";
import { CatalogCard } from "@/components/site/catalog-card";
import { Highlight, InView } from "@/components/site/effects";
import { FaqSection } from "@/components/site/faq-section";
import { FoundationSection } from "@/components/site/foundation-section";
import { HomeHero, type HeroFigure } from "@/components/site/home-hero";
import { PartnerTrustBanner } from "@/components/site/partner-trust-banner";
import { PlatformShowcase } from "@/components/site/platform-showcase";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { VideoSpotlight } from "@/components/site/video-spotlight";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { getViewer } from "@/server/auth";
import { getCatalog } from "@/server/queries/public";
import ctaPhoto from "../../../public/brand/photos/visite-bibliotheque.jpg";

/**
 * Hidden until confirmed (decision of 11/10/2026, see docs/institution/reference-sanady.md):
 * - partners: written confirmation from the Foundation and right to use the official logos
 *   (logo files to add under public/brand/partners/);
 * - testimonials: real quotes from pilot teachers, with their consent (replace the examples).
 */
const SHOW_PARTNERS = false;
const SHOW_TESTIMONIALS = false;

export const metadata: Metadata = {
  title: { absolute: "SANADY — Formation et développement professionnel des enseignants" },
  description:
    "Formations pour les enseignants, proposées par la Fondation Sanady : vidéos, documents, évaluations par module et certificat vérifiable.",
};

const CATEGORY_ICONS: LucideIcon[] = [GraduationCap, Users, Laptop, BookOpen, BarChart3, ClipboardCheck];

/**
 * Key figures. Live platform counters (courses, certificates…) stay small during
 * the pilot and read as weakness, so the band shows stable facts instead:
 * 2009 and the program rules are verified; « 500 » is the figure chosen on
 * 11/10/2026, to be confirmed in writing (docs/institution/reference-sanady.md).
 */
const FIGURES: HeroFigure[] = [
  { value: 2009, animate: false, label: "au service de l’école publique" },
  { value: 1200, prefix: "+", animate: true, label: "enseignants formés par la Fondation" },
  { value: 100, suffix: " %", animate: true, label: "en ligne, à votre rythme" },
  { value: 70, suffix: " %", animate: true, label: "de réussite pour valider un module" },
];

const STEPS = [
  { icon: Mail, title: "Recevez une invitation", text: "De la Fondation Sanady ou de votre établissement — ou demandez un accès en ligne." },
  { icon: PlayCircle, title: "Apprenez à votre rythme", text: "Vidéos et documents courts, sur ordinateur, tablette ou téléphone." },
  { icon: ClipboardCheck, title: "Validez chaque module", text: "Une évaluation à la fin de chaque module : 70 % de réussite, trois tentatives." },
  { icon: Award, title: "Obtenez votre certificat", text: "Délivré automatiquement, vérifiable en ligne par QR code." },
];

/** Burst of Sanady-coloured dots around the certificate step. */
const CONFETTI = Array.from({ length: 16 }, (_, k) => {
  const angle = (k / 16) * Math.PI * 2;
  const dist = 58 + (k % 4) * 14;
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist),
    r: 120 + k * 37,
    color: ["var(--color-accent-500)", "var(--color-accent-300)", "var(--color-success-600)", "var(--color-brand-700)"][k % 4],
  };
});

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider ${light ? "text-accent-400" : "text-accent-700"}`}>
      <BrandDots /> {children}
    </p>
  );
}

export default async function HomePage() {
  const [catalog, viewer] = await Promise.all([getCatalog(), getViewer()]);
  const featured = catalog.courses.slice(0, 3);

  return (
    <>
      <HomeHero categories={catalog.categories} courseTitle={featured[0]?.title ?? "Évaluation formative en classe"} figures={FIGURES} />

      {SHOW_PARTNERS ? <PartnerTrustBanner /> : null}

      {/* ─── Featured courses ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-6 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Catalogue</Eyebrow>
            <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
              Formations <Highlight>à la une</Highlight>
            </h2>
            <p className="mt-2 max-w-2xl text-reading text-ink-600">Des parcours courts et concrets, directement utiles dans votre classe.</p>
          </div>
          <Link href="/formations" className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
            Voir tout le catalogue <ArrowRight aria-hidden />
          </Link>
        </Reveal>

        {catalog.categories.length ? (
          <Reveal className="mt-8 flex flex-wrap gap-2.5">
            {catalog.categories.map((c, i) => {
              const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length]!;
              return (
                <Link
                  key={c.id}
                  href={`/formations?theme=${c.id}`}
                  className="group inline-flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-body font-semibold text-ink-800 shadow-xs transition hover:-translate-y-0.5 hover:border-accent-500/50 hover:shadow-md"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent-50 text-accent-700 transition-colors group-hover:bg-accent-500 group-hover:text-white">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {c.name}
                  <span className="tabular rounded-full bg-ink-100 px-2 text-caption text-ink-600">{c.count}</span>
                </Link>
              );
            })}
          </Reveal>
        ) : null}

        {featured.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <CatalogCard course={c} />
              </Reveal>
            ))}
            {featured.length % 3 !== 0 ? (
              <Reveal delay={featured.length * 80} className={featured.length % 2 === 0 ? "sm:max-lg:hidden" : undefined}>
                <Link
                  href="/formations"
                  className="group relative flex h-full min-h-64 flex-col justify-end overflow-hidden rounded-2xl bg-brand-800 p-7 text-white"
                >
                  <div aria-hidden className="absolute inset-0 bg-dots-light opacity-60" />
                  <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-accent-500/30 blur-3xl transition-transform duration-700 group-hover:scale-125" />
                  <span className="relative flex size-12 items-center justify-center rounded-xl bg-white/10 text-accent-400 ring-1 ring-white/15">
                    <BookOpen className="size-6" aria-hidden />
                  </span>
                  <span className="relative mt-6 block text-section font-bold">D’autres formations en préparation</span>
                  <span className="relative mt-2 block text-body leading-relaxed text-white/70">
                    Le catalogue s’enrichit progressivement avec l’équipe pédagogique de la Fondation Sanady.
                  </span>
                  <span className="relative mt-5 inline-flex items-center gap-1.5 text-body font-bold text-accent-400">
                    Explorer le catalogue
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </Reveal>
            ) : null}
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border border-dashed border-line-strong bg-ink-25 p-10 text-center text-body text-ink-600">
            Les premières formations seront bientôt présentées ici.
          </p>
        )}
      </section>

      {/* ─── The teacher space, shown ─────────────────────────────────────── */}
      <PlatformShowcase />

      {/* ─── How it works: a connected timeline ───────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Parcours</Eyebrow>
          <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
            De l’invitation au certificat, <Highlight>en quatre étapes</Highlight>
          </h2>
          <p className="mt-3 text-reading text-ink-600">Une expérience fluide, conçue pour s’adapter aux contraintes de temps des enseignants.</p>
        </Reveal>
        <InView as="ol" threshold={0.45} className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* The path fills from the invitation to the certificate. */}
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-1 overflow-hidden rounded-full bg-ink-100 lg:block">
            <span className="path-fill block h-full w-full rounded-full bg-gradient-to-r from-accent-300 via-accent-500 to-accent-600" />
          </span>
          {STEPS.map((s, i) => {
            const last = i === STEPS.length - 1;
            return (
              <li key={s.title} className="group relative flex flex-col items-center text-center" style={{ "--i": i } as React.CSSProperties}>
                <span className="relative">
                  <span
                    className={`path-icon relative flex size-16 items-center justify-center rounded-2xl bg-accent-600 text-white shadow-lg ring-8 ring-surface group-hover:-translate-y-1 ${last ? "path-finale" : ""}`}
                  >
                    <s.icon className="size-6" aria-hidden />
                  </span>
                  <span className="path-check absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-success-600 text-white ring-2 ring-surface">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  {last
                    ? CONFETTI.map((c, k) => (
                        <span
                          key={k}
                          aria-hidden
                          className="confetti"
                          style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--c": c.color, "--r": `${c.r}deg`, borderRadius: k % 3 ? "2px" : "9999px" } as React.CSSProperties}
                        />
                      ))
                    : null}
                </span>
                <p className="mt-6 text-caption font-bold uppercase tracking-wider text-accent-700">Étape {i + 1}</p>
                <h3 className="mt-1 text-section font-bold text-ink-900">{s.title}</h3>
                <p className="mt-2 max-w-[16rem] text-body leading-relaxed text-ink-600">{s.text}</p>
              </li>
            );
          })}
        </InView>
      </section>

      {SHOW_TESTIMONIALS ? <TestimonialsSection /> : null}

      {/* ─── Official film (dark) ─────────────────────────────────────────── */}
      <VideoSpotlight id="video-fondation" initialTime={51} showDetails={false} />

      {/* ─── The Foundation: mission, vision, three pillars (from sanady.org) ── */}
      <FoundationSection />

      {/* ─── For whom: teachers, schools, partners, companies ─────────────── */}
      <AudienceSection />

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ─── Call to action ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <Reveal className="relative isolate overflow-hidden rounded-[2rem] bg-brand-900 text-white shadow-2xl">
          <div aria-hidden className="absolute inset-0 -z-10 bg-dots-light opacity-60" />
          <div aria-hidden className="absolute -left-24 -top-24 -z-10 size-96 rounded-full bg-accent-500/30 blur-3xl" />
          <div className="grid items-stretch lg:grid-cols-[1.15fr_1fr]">
            <div className="p-8 sm:p-12 lg:p-14">
              <Eyebrow light>Fondation Sanady</Eyebrow>
              <h2 className="mt-4 text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-[2.75rem]">
                Prêt à développer <Highlight tone="dark">vos pratiques</Highlight> ?
              </h2>
              <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-white/70">
                {viewer ? "Retrouvez vos formations là où vous les avez laissées." : "Rejoignez la communauté des enseignants SANADY au Maroc et faites grandir vos élèves."}
              </p>
              <ul className="mt-6 space-y-2 text-body text-white/80">
                {["Formations courtes et concrètes", "Certificat délivré par la Fondation", "À votre rythme, sur tous vos appareils"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-accent-400" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap gap-3">
                {viewer ? (
                  <Link href="/mon-espace" className={buttonClasses({ variant: "brand", size: "xl", className: "btn-sheen rounded-xl" })}>
                    Accéder à mon espace <ArrowRight aria-hidden />
                  </Link>
                ) : (
                  <>
                    <Link href="/demande-acces" className={buttonClasses({ variant: "brand", size: "xl", className: "btn-sheen rounded-xl" })}>
                      Demander un accès <ArrowRight aria-hidden />
                    </Link>
                    <Link
                      href="/connexion"
                      className={buttonClasses({ size: "xl", className: "rounded-xl bg-white/10! font-bold text-white ring-1 ring-inset ring-white/25 hover:bg-white/20!" })}
                    >
                      Se connecter
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="relative min-h-72 lg:min-h-full">
              <Image src={ctaPhoto} alt="Des enseignants découvrent des ressources pédagogiques dans une bibliothèque scolaire" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/20 to-transparent lg:bg-gradient-to-r" />
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
