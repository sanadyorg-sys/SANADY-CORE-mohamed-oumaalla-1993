"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { ArrowRight, BadgeCheck, BookOpen, FolderOpen, Layers, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

const QUICK_LINKS = [
  { href: "/formations", label: "Toutes les formations", icon: BookOpen },
  { href: "/programmes", label: "Programmes", icon: Layers },
  { href: "/ressources", label: "Ressources", icon: FolderOpen },
  { href: "/verifier", label: "Vérifier un certificat", icon: BadgeCheck },
];

/**
 * Header search: a compact trigger that opens a search panel near the top of
 * the screen (Ctrl K / ⌘ K or « / » from anywhere). Replaces the inline field,
 * which became unreadably narrow next to the six navigation links.
 */
export function SiteSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          aria-label="Ouvrir la recherche"
          className={cn(
            // Labelled pill while the links are in the drawer (768–1023 px); a round icon once they share the row.
            "group flex h-9 items-center justify-center gap-2 rounded-full border border-line bg-ink-25/80 text-body text-ink-500 transition-colors hover:border-line-strong hover:bg-surface hover:text-ink-800 max-lg:pl-3 max-lg:pr-2 lg:w-9",
            className,
          )}
          title="Rechercher (Ctrl K)"
        >
          <Search className="size-4 text-ink-600 group-hover:text-accent-600" aria-hidden />
          <span className="lg:hidden">Rechercher</span>
          <kbd className="whitespace-nowrap rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-caption font-semibold text-ink-500 lg:hidden">
            Ctrl K
          </kbd>
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <RadixDialog.Content className="animate-fade-up fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop focus-visible:outline-none">
          <RadixDialog.Title className="sr-only">Rechercher une formation</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Saisissez un thème, un titre ou un mot-clé.</RadixDialog.Description>
          <form action="/formations" role="search" onSubmit={() => setOpen(false)} className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-5 shrink-0 text-accent-600" aria-hidden />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Rechercher une formation</span>
              <input
                type="search"
                name="q"
                autoFocus
                placeholder="Que souhaitez-vous apprendre ?"
                className="h-14 w-full bg-transparent text-[1rem] text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </label>
            <RadixDialog.Close
              aria-label="Fermer"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              <X className="size-4" aria-hidden />
            </RadixDialog.Close>
          </form>
          <div className="p-2">
            <p className="px-3 pb-1 pt-2 text-caption font-semibold uppercase tracking-wider text-ink-500">Accès rapides</p>
            <ul>
              {QUICK_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-body font-medium text-ink-800 transition-colors hover:bg-accent-50 hover:text-accent-800 focus-visible:bg-accent-50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-ink-50 text-ink-600 group-hover:bg-white group-hover:text-accent-600">
                      <l.icon className="size-4" aria-hidden />
                    </span>
                    {l.label}
                    <ArrowRight className="ml-auto size-4 -translate-x-1 text-accent-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-3 border-t border-line bg-ink-25 px-4 py-2.5 text-caption text-ink-500">
            <span>
              <kbd className="rounded border border-line bg-surface px-1 font-sans font-semibold">Entrée</kbd> pour rechercher
            </span>
            <span>
              <kbd className="rounded border border-line bg-surface px-1 font-sans font-semibold">Échap</kbd> pour fermer
            </span>
            <span className="ml-auto max-sm:hidden">
              <kbd className="rounded border border-line bg-surface px-1 font-sans font-semibold">Ctrl K</kbd> ou{" "}
              <kbd className="rounded border border-line bg-surface px-1 font-sans font-semibold">/</kbd> pour ouvrir
            </span>
          </p>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
