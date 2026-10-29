"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";

const SRC = "/brand/video/hero-formation.mp4";
const PAUSED_PREF = "sanady.hero.video";

/**
 * Muted, looping background film for the home hero (stock clip: a training
 * session, Pexels licence — see formation doc), with a slow zoom and a
 * pause / play button (WCAG 2.2.2: moving content can be stopped).
 *
 * The file (0.9 MB) is attached on every screen size, but never with
 * « réduire les animations », the browser's data saver or a 2G connection on:
 * those visitors keep the light, still hero. A pause is remembered.
 */
export function HeroVideo({ className, controlClassName }: { className?: string; controlClassName?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = connection?.saveData === true || /(^|-)2g$/.test(connection?.effectiveType ?? "");
    if (reduced || slow) return;
    // React does not always reflect the muted attribute, and browsers only autoplay muted video.
    video.muted = true;
    const shown = () => {
      video.setAttribute("data-playing", "");
      setActive(true);
    };
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    video.addEventListener("playing", shown);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.src = SRC;

    let keepPaused = false;
    try {
      keepPaused = localStorage.getItem(PAUSED_PREF) === "paused";
    } catch {
      // Storage blocked: the film plays.
    }
    if (keepPaused) {
      // Show the first frame, still, with the play button ready.
      video.preload = "auto";
      video.addEventListener(
        "loadeddata",
        () => {
          video.setAttribute("data-playing", "");
          setActive(true);
          setPaused(true);
        },
        { once: true },
      );
      video.load();
    } else {
      video.play().catch(() => {
        // Autoplay refused: the hero simply stays still.
      });
    }
    return () => {
      video.removeEventListener("playing", shown);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    const pause = !video.paused;
    if (pause) video.pause();
    else void video.play().catch(() => {});
    try {
      localStorage.setItem(PAUSED_PREF, pause ? "paused" : "playing");
    } catch {
      // Choice not remembered; the button still works on this page.
    }
  };

  return (
    <>
      <video
        ref={ref}
        aria-hidden
        tabIndex={-1}
        muted
        loop
        playsInline
        preload="none"
        data-paused={paused ? "" : undefined}
        className={className}
      />
      {active ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? "Lire la vidéo d’arrière-plan" : "Mettre en pause la vidéo d’arrière-plan"}
          title={paused ? "Lire la vidéo" : "Mettre la vidéo en pause"}
          className={cn(
            "animate-fade-up flex size-10 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-inset ring-white/20 backdrop-blur transition-colors hover:bg-white/20 hover:text-white active:scale-95 focus-visible:outline-white",
            controlClassName,
          )}
        >
          {paused ? <Play className="ml-0.5 size-4" fill="currentColor" aria-hidden /> : <Pause className="size-4" fill="currentColor" aria-hidden />}
        </button>
      ) : null}
    </>
  );
}
