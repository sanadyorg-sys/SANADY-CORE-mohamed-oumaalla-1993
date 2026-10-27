import Link from "next/link";
import { ArrowRight, LifeBuoy, Plus } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";

/** Answers drawn only from the platform's actual rules (access, validation, certificate). */
const QUESTIONS = [
  {
    q: "Qui peut suivre les formations SANADY ?",
    a: "Les formations sont réservées aux enseignants. L’accès se fait sur invitation de la Fondation Sanady ou de votre établissement ; vous pouvez aussi demander un accès en ligne.",
  },
  {
    q: "Comment se déroule une formation ?",
    a: "Chaque formation est organisée en modules : de courtes vidéos et des documents pratiques, puis une évaluation à la fin du module. Vous avancez à votre rythme et reprenez là où vous vous êtes arrêté.",
  },
  {
    q: "Comment valider un module ?",
    a: "En obtenant au moins 70 % à l’évaluation du module. Vous disposez de trois tentatives, et chaque réponse est accompagnée d’une explication.",
  },
  {
    q: "Comment obtenir mon certificat ?",
    a: "Il est délivré automatiquement par la Fondation Sanady lorsque toutes les leçons obligatoires sont suivies et toutes les évaluations réussies. Chaque certificat porte un numéro et un QR code vérifiables en ligne.",
  },
  {
    q: "Puis-je me former sur mon téléphone ?",
    a: "Oui. La plateforme fonctionne sur téléphone, tablette et ordinateur, et votre progression vous suit d’un appareil à l’autre.",
  },
  {
    q: "Mon établissement peut-il suivre ma progression ?",
    a: "Les établissements partenaires disposent d’un espace dédié pour affecter des formations et suivre la progression de leurs enseignants. Vos formations personnelles restent privées.",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Questions fréquentes
          </p>
          <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.5rem]">
            Vous avez des questions ?
          </h2>
          <p className="mt-4 max-w-md text-reading leading-relaxed text-ink-600">
            L’essentiel pour bien démarrer sur SANADY. Pour le reste, notre centre d’aide est là.
          </p>
          <div className="mt-8 flex max-w-md items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <LifeBuoy className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-card font-bold text-ink-900">Une autre question ?</p>
              <p className="mt-0.5 text-body text-ink-600">Consultez l’aide ou demandez un accès pour être recontacté.</p>
              <Link href="/aide" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3 rounded-lg" })}>
                Centre d’aide <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>

        <div className="space-y-3">
          {QUESTIONS.map((item, i) => (
            <Reveal key={item.q} delay={i * 50}>
              <details className="group rounded-2xl border border-line bg-surface shadow-xs transition-colors open:border-accent-500/40 open:shadow-sm" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <span className="text-card font-bold text-ink-900 sm:text-section">{item.q}</span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-600 ring-1 ring-line transition duration-300 group-open:rotate-45 group-open:bg-accent-500 group-open:text-white group-open:ring-accent-500">
                    <Plus className="size-4" aria-hidden />
                  </span>
                </summary>
                <p className="-mt-1 px-6 pb-6 text-body leading-relaxed text-ink-600 sm:text-reading">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
