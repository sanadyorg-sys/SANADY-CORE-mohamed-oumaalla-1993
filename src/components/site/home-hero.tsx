import Image from "next/image";
import Link from "next/link";
import { Award, CheckCircle2, QrCode, Search } from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { PointerGlow, Tilt } from "@/components/site/effects";
import { HeroDoodles } from "@/components/site/hero-doodles";
import { HeroLearnerPreview } from "@/components/site/hero-learner-preview";
import { HeroVideo } from "@/components/site/hero-video";
import { buttonClasses } from "@/components/ui/button";
import { CountUp } from "@/components/ui/motion";
// The platform is for teachers: one photo of teachers in a Foundation training session.
import trainingSession from "../../../public/brand/photos/session-formation.jpg";

export interface HeroFigure {
  value: number;
  prefix?: string;
  suffix?: string;
  animate: boolean;
  label: string;
}

/**
 * Home hero: dark, immersive band with the promise and the search on the
 * left, one training photo with floating product cards on the right, a muted
 * training film playing behind it all, and the key figures as a glass strip
 * along the bottom.
 */
export function HomeHero({
  categories,
  courseTitle,
  figures,
}: {
  categories: Array<{ id: string; name: string }>;
  courseTitle: string;
  figures: HeroFigure[];
}) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-900 text-white">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <HeroVideo className="hero-video absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand-900/65" />
        <div className="absolute -right-40 -top-40 size-[42rem] rounded-full bg-accent-500/20 blur-3xl animate-blob" />
        <div className="absolute -bottom-48 -left-40 size-[36rem] rounded-full bg-accent-600/15 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-brand-900 to-transparent" />
      </div>
      <HeroDoodles />
      <PointerGlow className="-z-10" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-10 pt-14 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-12 lg:px-8 lg:pb-14 lg:pt-20">
        {/* ─── Promise ─────────────────────────────────────────────── */}
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2.5 rounded-full bg-white/[0.08] px-3.5 py-1.5 text-label font-medium text-white/90 ring-1 ring-inset ring-white/15 backdrop-blur">
            <span className="live-radar" aria-hidden />
            <BrandDots />
            Fondation Sanady · Formation continue des enseignants
          </p>

          <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[3.25rem] lg:text-[3.875rem]">
            Développez vos pratiques,{" "}
            <SmileUnderline className="text-accent-400">faites grandir</SmileUnderline> vos élèves.
          </h1>

          <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-white/75 sm:text-[1.1875rem]">
            Des formations pratiques, conçues pour les enseignants du Maroc, à suivre à votre rythme : vidéos, documents, évaluations et
            certificat délivré par la Fondation Sanady.
          </p>

          <form action="/formations" role="search" className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/30 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Que souhaitez-vous apprendre ?</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                type="search"
                name="q"
                placeholder="Que souhaitez-vous apprendre ?"
                className="h-12 w-full rounded-xl bg-transparent pl-12 pr-4 text-[1rem] text-ink-900 placeholder:text-ink-500 focus:outline-none"
              />
            </label>
            <button type="submit" className={buttonClasses({ variant: "brand", size: "xl", className: "btn-sheen rounded-xl" })}>
              Rechercher
            </button>
          </form>

          {categories.length ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-label text-white/55">Populaires :</span>
              {categories.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  href={`/formations?theme=${c.id}`}
                  className="rounded-full bg-white/[0.07] px-3 py-1 text-label font-medium text-white/85 ring-1 ring-inset ring-white/15 transition hover:bg-white/15 hover:text-white"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          ) : null}

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-label font-medium text-white/80">
            {["Certificat vérifiable", "Sur mobile et ordinateur", "Validé module par module"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-accent-400" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* ─── Photo ───────────────────────────────────────────────── */}
        <Tilt max={4} className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="relative h-[26rem] overflow-hidden rounded-[1.75rem] ring-1 ring-white/10 sm:h-[32rem]">
            <Image
              src={trainingSession}
              alt="Des enseignants suivent une session de formation de la Fondation Sanady"
              fill
              priority
              placeholder="blur"
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-900/50 via-transparent to-transparent" />
          </div>

          {/* Floating cards */}
          <div className="animate-float absolute -bottom-8 -left-2 text-ink-900 sm:-left-10">
            <HeroLearnerPreview courseTitle={courseTitle} />
          </div>
          <div aria-hidden className="cert-shine animate-float-slow absolute -left-2 top-6 hidden items-center gap-3 rounded-2xl bg-white p-3 pr-4 text-ink-900 shadow-2xl sm:flex lg:-left-8">
            <span className="flex size-10 items-center justify-center rounded-xl bg-success-50 text-success-700">
              <Award className="size-5" />
            </span>
            <span>
              <span className="block text-label font-bold">Certificat obtenu</span>
              <span className="flex items-center gap-1 text-caption text-ink-500">
                <QrCode className="size-3.5" /> Vérifiable en ligne
              </span>
            </span>
          </div>
        </Tilt>
      </div>

      {/* ─── Key figures ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pb-16">
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10 backdrop-blur lg:grid-cols-4">
          {figures.map((f, i) => (
            <div
              key={f.label}
              className={`flex flex-col-reverse px-6 py-6 ${i % 2 ? "border-l border-white/10" : ""} ${i >= 2 ? "border-t border-white/10 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <dt className="mt-1 text-label text-white/60">{f.label}</dt>
              <dd className="text-[2rem] font-extrabold leading-none tracking-tight sm:text-[2.5rem]">
                {f.animate ? <CountUp value={f.value} prefix={f.prefix} suffix={f.suffix} /> : f.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
