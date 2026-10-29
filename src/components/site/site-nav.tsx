"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";

export const SITE_LINKS = [
  { href: "/formations", label: "Formations" },
  { href: "/programmes", label: "Programmes" },
  { href: "/partenariats", label: "Partenariats" },
  { href: "/ressources", label: "Ressources" },
  { href: "/a-propos", label: "À propos" },
  { href: "/verifier", label: "Vérifier un certificat", short: "Vérifier" },
] as Array<{ href: string; label: string; /** Shown between 1024 and 1279 px, where the full label would wrap. */ short?: string }>;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden lg:block">
      <ul className="flex items-center gap-0.5 xl:gap-1">
        {SITE_LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className={cn(
                // Orange underline: grows in on hover, stays under the current section.
                "relative whitespace-nowrap rounded-md px-2.5 py-2 text-body font-medium text-ink-700 transition-colors hover:text-ink-900 xl:px-3",
                "after:absolute after:inset-x-2.5 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-accent-500 after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 xl:after:inset-x-3",
                isActive(pathname, l.href) && "font-semibold text-ink-900 after:scale-x-100",
              )}
            >
              {l.short ? (
                <>
                  <span className="xl:hidden" aria-hidden>
                    {l.short}
                  </span>
                  <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{l.label}</span>
                </>
              ) : (
                l.label
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteMobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      side="right"
      width="max-w-xs"
      title="Menu"
      trigger={
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
          <Menu />
        </Button>
      }
    >
      <form action="/formations" role="search" className="mb-4" onSubmit={close}>
        <label className="block">
          <span className="sr-only">Rechercher une formation</span>
          <input
            type="search"
            name="q"
            placeholder="Rechercher une formation"
            className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-body text-ink-900 placeholder:text-ink-400 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
          />
        </label>
      </form>
      <nav aria-label="Navigation principale (mobile)" className="flex flex-col gap-1">
        {SITE_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={close}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2.5 text-card font-medium text-ink-800 hover:bg-ink-100",
              isActive(pathname, l.href) && "bg-accent-50 text-accent-700",
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6">
        {signedIn ? (
          <Link href="/mon-espace" onClick={close} className={buttonClasses({ variant: "accent", size: "lg" })}>
            Mon espace
          </Link>
        ) : (
          <>
            <Link href="/demande-acces" onClick={close} className={buttonClasses({ variant: "accent", size: "lg" })}>
              Demander un accès
            </Link>
            <Link href="/connexion" onClick={close} className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Se connecter
            </Link>
          </>
        )}
      </div>
    </Drawer>
  );
}
