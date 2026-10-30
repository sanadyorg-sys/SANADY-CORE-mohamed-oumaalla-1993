import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { buttonClasses } from "@/components/ui/button";
import { ScrollHeader } from "./scroll-header";
import { SiteMobileMenu, SiteNavLinks } from "./site-nav";
import { SiteSearch } from "./site-search";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <ScrollHeader>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:gap-4 lg:px-8">
        <Link href="/" className="shrink-0 rounded-sm" aria-label="SANADY — accueil">
          <BrandLogo className="h-9 lg:h-10" priority />
        </Link>
        <SiteNavLinks />
        <div className="ml-auto flex items-center gap-2">
          <SiteSearch className="max-md:hidden" />
          {signedIn ? (
            <Link href="/mon-espace" className={buttonClasses({ variant: "accent", className: "group max-sm:hidden" })}>
              <LayoutDashboard aria-hidden /> Mon espace
            </Link>
          ) : (
            <>
              <Link
                href="/connexion"
                className={buttonClasses({ variant: "ghost", className: "max-sm:hidden" })}
              >
                <LogIn aria-hidden />
                Se connecter
              </Link>
              <Link href="/demande-acces" className={buttonClasses({ variant: "accent", className: "group max-sm:hidden" })}>
                Demander un accès
                <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </>
          )}
          <SiteMobileMenu signedIn={signedIn} />
        </div>
      </div>
    </ScrollHeader>
  );
}
