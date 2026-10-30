"use client";

import { useState } from "react";
import { Check, Link2, Mail } from "lucide-react";

/** Share links for a public article (no third-party script: plain share URLs). */
export function NewsShare({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const targets = [
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: the address stays visible in the browser bar.
    }
  };
  const item =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-label font-medium text-ink-700 transition-colors hover:border-line-strong hover:bg-ink-50 hover:text-ink-900";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-label font-semibold text-ink-800">Partager :</span>
      {targets.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={item}>
          {s.label}
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      ))}
      <a href={`mailto:?subject=${t}&body=${u}`} className={item}>
        <Mail className="size-3.5" aria-hidden /> E-mail
      </a>
      <button type="button" onClick={copy} className={item} aria-live="polite">
        {copied ? <Check className="size-3.5 text-success-600" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
        {copied ? "Lien copié" : "Copier le lien"}
      </button>
    </div>
  );
}
