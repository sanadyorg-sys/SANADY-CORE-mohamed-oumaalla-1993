"use client";

import { useEffect, useRef } from "react";

const SRC = "/brand/video/hero-formation.mp4";

/**
 * Muted, looping background film for the home hero (stock clip: a training
 * session, Pexels licence — see formation doc). Decorative only.
 *
 * The file is attached only on screens from 768px wide, and never with
 * « réduire les animations » or the browser's data saver on: teachers on
 * mobile data keep the light, still hero.
 */
export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduced || !wide || saveData) return;
    // React does not always reflect the muted attribute, and browsers only autoplay muted video.
    video.muted = true;
    const shown = () => video.setAttribute("data-playing", "");
    video.addEventListener("playing", shown);
    video.src = SRC;
    video.play().catch(() => {
      // Autoplay refused: the hero simply stays still.
    });
    return () => video.removeEventListener("playing", shown);
  }, []);

  return (
    <video
      ref={ref}
      aria-hidden
      tabIndex={-1}
      muted
      loop
      playsInline
      preload="none"
      className={className}
    />
  );
}
