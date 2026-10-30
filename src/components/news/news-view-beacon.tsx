"use client";

import { useEffect } from "react";

/**
 * Counts one view of an article once it is shown (not on link prefetch).
 * The server keeps daily totals only — nothing about who read it.
 */
export function NewsViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const body = JSON.stringify({ slug });
    try {
      if (!navigator.sendBeacon?.("/api/actualites/vue", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/actualites/vue", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      // Statistics are best effort.
    }
  }, [slug]);
  return null;
}
