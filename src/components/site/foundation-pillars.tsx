"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Compass, GraduationCap, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface Pillar {
  key: string;
  title: string;
  tagline: string;
  text: string;
  programs: string[];
  /** Programme the SANADY platform belongs to, if any. */
  platform?: string;
  image: StaticImageData;
  icon: "learning" | "future" | "awakening";
}

const ICONS: Record<Pillar["icon"], LucideIcon> = { learning: BookOpen, future: Compass, awakening: Sparkles };

/**
 * The Foundation's three fields of action as expanding panels (inspired by
 * sanady.org's opening section banners). The open panel advances on its own
 * every few seconds until the visitor hovers, focuses or clicks one.
 * Below 1024 px the panels are simply stacked, all open.
 */
export function FoundationPillars({ pillars }: { pillars: Pillar[] }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    let visible = false;
    const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)));
    if (el) io.observe(el);
    const id = window.setInterval(() => {
      if (visible) setActive((a) => (a + 1) % pillars.length);
    }, 6000);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [auto, pillars.length]);

  const choose = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <div ref={ref} className="flex flex-col gap-4 lg:h-[34rem] lg:flex-row" onMouseLeave={() => setAuto(true)}>
      {pillars.map((p, i) => {
        const open = i === active;
        const Icon = ICONS[p.icon];
        return (
          <article
            key={p.key}
            onMouseEnter={() => choose(i)}
            className={cn(
              "group relative isolate min-h-[26rem] overflow-hidden rounded-[1.75rem] text-white ring-1 ring-black/5 transition-[flex-grow] duration-700 ease-[var(--ease-out-strong)] lg:min-h-0",
              open ? "lg:flex-[3.2]" : "lg:flex-1",
            )}
          >
            <Image
              src={p.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className={cn("-z-20 object-cover transition-transform duration-[1.6s] ease-out", open ? "scale-105" : "scale-100")}
            />
            <div aria-hidden className={cn("absolute inset-0 -z-10 transition-colors duration-700", open ? "bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/10" : "bg-brand-900/70")} />

            {/* Collapsed label (desktop) */}
            <button
              type="button"
              onClick={() => choose(i)}
              onFocus={() => choose(i)}
              aria-expanded={open}
              aria-controls={`pilier-${p.key}`}
              className={cn(
                "absolute inset-0 hidden flex-col items-center justify-between py-8 transition-opacity duration-500 lg:flex",
                open ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-500 shadow-lg">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[1.375rem] font-extrabold tracking-tight">
                {p.title}
              </span>
              <span className="text-caption font-bold text-white/60">0{i + 1}</span>
            </button>

            {/* Content */}
            <div
              id={`pilier-${p.key}`}
              className={cn(
                "relative flex h-full flex-col justify-end p-7 transition-[opacity,translate] duration-700 sm:p-9",
                open ? "lg:translate-y-0 lg:opacity-100 lg:delay-200" : "lg:pointer-events-none lg:translate-y-4 lg:opacity-0",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-500 shadow-lg">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-caption font-bold uppercase tracking-[0.18em] text-accent-300">Pilier 0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-[2.125rem]">{p.title}</h3>
              <p className="mt-1 text-reading font-semibold text-accent-300">{p.tagline}</p>
              <p className="mt-3 max-w-xl text-body leading-relaxed text-white/80 sm:text-reading">{p.text}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {p.programs.map((prog) => {
                  const here = prog === p.platform;
                  return (
                    <li
                      key={prog}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label font-semibold backdrop-blur",
                        // accent-700, not the logo orange: small white text needs 4.5:1 (WCAG AA).
                        here ? "bg-accent-700 text-white shadow-lg" :"bg-white/10 text-white ring-1 ring-inset ring-white/20",
                      )}
                    >
                      {here ? <GraduationCap className="size-4" aria-hidden /> : null}
                      {prog}
                    </li>
                  );
                })}
              </ul>
              {p.platform ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-label font-medium text-white/85">
                  <ArrowRight className="size-4 text-accent-400" aria-hidden />
                  La plateforme SANADY prolonge la {p.platform.toLowerCase()}.
                </p>
              ) : null}
            </div>

            {/* Progress line of the automatic rotation */}
            {open && auto ? (
              <span aria-hidden className="pillar-timer absolute inset-x-0 bottom-0 hidden h-1 origin-left bg-accent-500 lg:block" />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
