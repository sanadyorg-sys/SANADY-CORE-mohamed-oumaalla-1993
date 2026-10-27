import Link from "next/link";
import { ArrowUpRight, Quote } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { InView } from "@/components/site/effects";
import { FoundationPillars, type Pillar } from "@/components/site/foundation-pillars";
import { CountUp, Reveal } from "@/components/ui/motion";
import future from "../../../public/brand/photos/forum-orientation.jpg";
import awakening from "../../../public/brand/photos/sortie-plein-air.jpg";
import learning from "../../../public/brand/photos/classe-primaire.jpg";

/*
 * Institutional content from the Foundation's site (sanady.org), as recorded
 * in docs/institution/reference-sanady.md. Figures are those published by the
 * Foundation (2018 site); to be confirmed with the Foundation before launch.
 */

const VISION = "Aucun élève de l’école publique ne devrait abandonner ou échouer à l’école.";

const PILLARS: Pillar[] = [
  {
    key: "apprentissage",
    title: "Autour de l’apprentissage",
    tagline: "Faire réussir chaque élève",
    text: "Des cours de soutien dans les locaux de l’école publique, de la 3e année du primaire jusqu’au Bac, et la formation continue des enseignants qui les accompagnent.",
    programs: ["Soutien scolaire", "Formation continue des enseignants", "Mallette pédagogique"],
    platform: "Formation continue des enseignants",
    image: learning,
    icon: "learning",
  },
  {
    key: "avenir",
    title: "Autour de l’avenir",
    tagline: "Ouvrir les portes de demain",
    text: "Accompagner les élèves dès le collège dans leurs choix d’orientation, pour qu’aucun ne soit exclu des études supérieures d’excellence à cause de son milieu social.",
    programs: ["Orientation scolaire et professionnelle", "Assistance aux bourses d’études supérieures"],
    image: future,
    icon: "future",
  },
  {
    key: "eveil",
    title: "Autour de l’éveil",
    tagline: "Ouvrir les horizons",
    text: "Ouvrir les horizons des élèves à travers l’art, la culture et le sport, et redonner vie aux écoles : locaux, sanitaires, bibliothèques et équipement informatique.",
    programs: ["Activités parascolaires", "Réhabilitation des écoles"],
    image: awakening,
    icon: "awakening",
  },
];

const FIELD_FIGURES: Array<{ value: number; prefix?: string; suffix?: string; label: string; animate?: boolean }> = [
  { value: 37800, suffix: " h", label: "de cours de soutien scolaire dispensées" },
  { value: 12, label: "élèves au maximum par classe de soutien" },
  { value: 10, prefix: "≈ ", label: "moments de formation des enseignants par an" },
];

const SIGNATURE = "Préparons les adultes du Maroc de demain";

export function FoundationSection() {
  const words = VISION.split(" ");
  return (
    <section aria-labelledby="fondation-titre" className="relative isolate overflow-hidden bg-surface">
      {/* ─── Mission & vision ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> La Fondation Sanady
            </p>
            <h2 id="fondation-titre" className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
              Une association reconnue d’utilité publique, au service de l’école publique
            </h2>
            <p className="mt-5 text-reading leading-relaxed text-ink-600">
              <span className="font-semibold text-ink-900">Notre mission :</span> offrir un accompagnement éducatif continu et de qualité aux élèves issus de
              milieux socio-économiques défavorisés, ruraux et péri-urbains, afin de contribuer à leur réussite scolaire et libérer leur potentiel.
            </p>
            <a
              href="https://sanady.org"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-body font-bold text-accent-700 hover:underline"
            >
              Découvrir la Fondation sur sanady.org <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Reveal>

          {/* Vision, revealed word by word */}
          <InView threshold={0.5} className="relative rounded-[2rem] bg-brand-900 p-8 text-white shadow-2xl sm:p-12">
            <div aria-hidden className="absolute inset-0 -z-0 overflow-hidden rounded-[2rem]">
              <div className="absolute inset-0 bg-dots-light opacity-60" />
              <div className="absolute -right-16 -top-16 size-72 rounded-full bg-accent-500/25 blur-3xl" />
            </div>
            <Quote className="relative size-10 text-accent-500" aria-hidden />
            <p className="relative mt-3 text-caption font-bold uppercase tracking-[0.2em] text-accent-300">Notre vision</p>
            <blockquote className="word-reveal relative mt-4 text-[1.625rem] font-extrabold leading-snug tracking-tight sm:text-[2.125rem]">
              {words.map((w, i) => (
                <span key={i} style={{ "--w": i } as React.CSSProperties}>
                  {w}{" "}
                </span>
              ))}
            </blockquote>
            <p className="relative mt-6 max-w-xl text-body leading-relaxed text-white/70">
              Un accompagnement éducatif complémentaire, pour que chaque élève poursuive sa scolarité aussi loin que ses capacités le lui permettent et
              entre dans la vie active avec plus de confiance et d’autonomie.
            </p>
          </InView>
        </div>

        {/* Field figures */}
        <Reveal as="dl" className="mt-12 grid gap-4 sm:grid-cols-3">
          {FIELD_FIGURES.map((f) => (
            <div key={f.label} className="flex flex-col-reverse rounded-2xl border border-line bg-ink-25 p-5 sm:p-6">
              <dt className="mt-2 text-label leading-snug text-ink-600">{f.label}</dt>
              <dd className="text-[1.75rem] font-extrabold leading-none tracking-tight text-ink-900 sm:text-[2.25rem]">
                {f.animate === false ? f.value : <CountUp value={f.value} prefix={f.prefix} suffix={f.suffix} />}
              </dd>
            </div>
          ))}
        </Reveal>
        <p className="mt-3 text-caption text-ink-500">Chiffres publiés par la Fondation Sanady sur sanady.org.</p>
      </div>

      {/* ─── Fields of action ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Champs d’intervention
            </p>
            <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">Trois piliers, un même élève</h2>
          </div>
          <Link href="/programmes" className="inline-flex items-center gap-1.5 text-body font-bold text-accent-700 hover:underline">
            Tous les programmes <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </Reveal>
        <FoundationPillars pillars={PILLARS} />
      </div>

      {/* ─── Signature band ─────────────────────────────────────────────── */}
      <div aria-label={SIGNATURE} role="img" className="marquee-mask overflow-hidden border-y border-line bg-ink-25 py-6 sm:py-8">
        <div className="marquee-track signature-track items-center" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="flex shrink-0 items-center gap-8 pr-8">
              <span className={i % 2 ? "text-outline" : "text-ink-900"}>{SIGNATURE}</span>
              <BrandDots className="[&>span]:size-3" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
