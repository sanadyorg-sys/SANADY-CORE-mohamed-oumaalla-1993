"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Captions,
  ClipboardCheck,
  Gauge,
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import type { ProgressUpdate } from "@/lib/types";
import type { NavTarget } from "@/server/queries/player";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const FLUSH_INTERVAL_MS = 15_000;
const BUCKETS = 100;
const CAPTIONS_PREF = "sanady.video.captions";

const SHORTCUTS: Array<[string, string]> = [
  ["Espace / K", "Lecture / pause"],
  ["← / →", "Reculer / avancer de 5 s"],
  ["J / L", "Reculer / avancer de 10 s"],
  ["↑ / ↓", "Volume"],
  ["M", "Couper / rétablir le son"],
  ["C", "Sous-titres"],
  ["F", "Plein écran"],
  ["0 – 9", "Aller à 0 %, 10 % … 90 %"],
  ["?", "Afficher cette aide"],
];

/** Subtitle-like text tracks, whatever their origin (<track>, native HLS, hls.js). */
function subtitleTracks(video: HTMLVideoElement) {
  return [...video.textTracks].filter((t) => t.kind === "subtitles" || t.kind === "captions");
}

/**
 * Accessible HTML5 video player with resume, speed control and
 * deduplicated coverage tracking.
 *
 * Coverage model: the video is split into 100 buckets (1 % each). Only
 * buckets crossed during continuous playback are recorded — seeking never
 * marks content as watched, and replaying the same segment adds nothing.
 * The server merges buckets as a set and rejects implausible jumps.
 */
export function VideoPlayer({
  lessonId,
  source,
  resumePosition,
  initialBuckets,
  completionThreshold,
  onProgress,
  trackProgress = true,
  next = null,
}: {
  lessonId: string;
  source: { type: "mp4" | "hls"; url: string; poster?: string; captions?: string };
  resumePosition: number;
  initialBuckets: number[];
  completionThreshold: number;
  onProgress?: (update: ProgressUpdate) => void;
  /** False in administrator preview: nothing is recorded. */
  trackProgress?: boolean;
  /** Where to go once the video has ended (shown on the end card). */
  next?: NavTarget | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pending = useRef<Set<number>>(new Set());
  const lastTime = useRef<number | null>(null);
  const seeking = useRef(false);
  const flushing = useRef(false);
  const lastSentPosition = useRef<number>(resumePosition);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const [watched, setWatched] = useState<Set<number>>(() => new Set(initialBuckets));
  const [syncError, setSyncError] = useState(false);
  const [hasCaptions, setHasCaptions] = useState(false);
  // Remembered choice. Safe at first render: nothing caption-related is drawn
  // until the tracks have loaded, so server and client markup still match.
  const [captionsOn, setCaptionsOn] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(CAPTIONS_PREF) === "on";
    } catch {
      return false; // Storage blocked: captions simply start off.
    }
  });
  const [cue, setCue] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [hover, setHover] = useState<{ ratio: number } | null>(null);
  const [flash, setFlash] = useState<{ text: string; key: number } | null>(null);

  /** Brief on-screen confirmation of a keyboard action (« + 10 s », « Volume 60 % »). */
  const announce = (text: string) => setFlash({ text, key: Date.now() });
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(timer);
  }, [flash]);

  // ─── Source attachment (native MP4/HLS, or hls.js) ───────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: { destroy(): void } | null = null;
    if (source.type === "hls" && !video.canPlayType("application/vnd.apple.mpegurl")) {
      let cancelled = false;
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError(true);
          return;
        }
        const instance = new Hls({ capLevelToPlayerSize: true });
        instance.loadSource(source.url);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(true);
        });
        hls = instance;
      });
      return () => {
        cancelled = true;
        hls?.destroy();
      };
    }
    video.src = source.url;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [source.type, source.url]);

  // ─── Progress synchronisation ────────────────────────────────────────────
  const flush = useCallback(async () => {
    const video = videoRef.current;
    if (!trackProgress || !video || flushing.current) return;
    const position = Math.floor(video.currentTime || 0);
    const buckets = [...pending.current];
    if (buckets.length === 0 && Math.abs(position - lastSentPosition.current) < 5) return;

    flushing.current = true;
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("record_video_progress", {
      p_lesson: lessonId,
      p_buckets: buckets,
      p_position: position,
      p_duration: Math.floor(video.duration || 0) || null,
    });
    flushing.current = false;

    if (rpcError) {
      setSyncError(true);
      return; // Keep pending buckets; they are retried on the next flush.
    }
    setSyncError(false);
    buckets.forEach((b) => pending.current.delete(b));
    lastSentPosition.current = position;
    onProgress?.(data as ProgressUpdate);
  }, [lessonId, onProgress, trackProgress]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  // ─── Fullscreen state ────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ─── Captions ────────────────────────────────────────────────────────────
  // Cues are drawn by the player itself (track mode "hidden"), so they sit above
  // the control bar and follow the Sanady style instead of the browser default.
  const captionTrack = useRef<TextTrack | null>(null);

  /** Text of the active cue(s); read on every time update (cuechange misses a cue already on screen). */
  const readCue = () => {
    const track = captionTrack.current;
    const text = track
      ? [...(track.activeCues ?? [])].map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, "")).join("\n")
      : "";
    setCue(text);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const list = video.textTracks;
    const sync = () => {
      const tracks = subtitleTracks(video);
      setHasCaptions(tracks.length > 0);
      const chosen = captionsOn ? (tracks.find((t) => t.language.startsWith("fr")) ?? tracks[0] ?? null) : null;
      for (const t of tracks) {
        const mode: TextTrackMode = t === chosen ? "hidden" : "disabled";
        if (t.mode !== mode) t.mode = mode;
      }
      captionTrack.current = chosen;
      readCue();
    };
    sync();
    list.addEventListener("addtrack", sync);
    list.addEventListener("removetrack", sync);
    return () => {
      list.removeEventListener("addtrack", sync);
      list.removeEventListener("removetrack", sync);
    };
  }, [captionsOn, source.url, source.captions]);

  const toggleCaptions = () => {
    if (!hasCaptions) return;
    const on = !captionsOn;
    setCaptionsOn(on);
    announce(on ? "Sous-titres activés" : "Sous-titres désactivés");
    try {
      localStorage.setItem(CAPTIONS_PREF, on ? "on" : "off");
    } catch {
      // Preference not kept; the toggle still works for this lesson.
    }
  };

  // ─── Media events ────────────────────────────────────────────────────────
  const markRange = (from: number, to: number, d: number) => {
    const start = Math.max(0, Math.floor((from / d) * BUCKETS));
    const end = Math.min(BUCKETS - 1, Math.floor((to / d) * BUCKETS));
    let added = false;
    for (let b = start; b <= end; b++) {
      if (!watched.has(b) && !pending.current.has(b)) {
        pending.current.add(b);
        added = true;
      }
    }
    if (added) setWatched((prev) => new Set([...prev, ...pending.current]));
  };

  const onTimeUpdate = () => {
    const video = videoRef.current!;
    const t = video.currentTime;
    const d = video.duration;
    setTime(t);
    readCue();
    if (!d || !Number.isFinite(d)) return;
    if (!video.paused && !seeking.current && lastTime.current !== null) {
      const delta = t - lastTime.current;
      // Normal playback only: a forward step consistent with the speed.
      if (delta > 0 && delta <= 2 + 2 * video.playbackRate) markRange(lastTime.current, t, d);
    }
    lastTime.current = t;
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current!;
    setDuration(video.duration);
    if (resumePosition > 5 && resumePosition < video.duration - 5) {
      video.currentTime = resumePosition;
    }
    lastTime.current = video.currentTime;
  };

  // ─── Controls ────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError(true));
    else video.pause();
  };
  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration || 0);
  };
  const changeRate = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setRate(r);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };
  const changeVolume = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Math.round(Math.min(1, Math.max(0, (video.muted ? 0 : video.volume) + delta)) * 100) / 100;
    video.volume = v;
    video.muted = v === 0;
    announce(`Volume ${Math.round(v * 100)} %`);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" && e.key !== " ") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (/^[0-9]$/.test(key) && duration) {
      e.preventDefault();
      if (videoRef.current) videoRef.current.currentTime = (Number(key) / 10) * duration;
      announce(`${Number(key) * 10} %`);
      return;
    }
    switch (key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(-5);
        announce("− 5 s");
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(5);
        announce("+ 5 s");
        break;
      case "ArrowUp":
        e.preventDefault();
        changeVolume(0.1);
        break;
      case "ArrowDown":
        e.preventDefault();
        changeVolume(-0.1);
        break;
      case "j":
        seekBy(-10);
        announce("− 10 s");
        break;
      case "l":
        seekBy(10);
        announce("+ 10 s");
        break;
      case "m":
        toggleMute();
        announce(videoRef.current?.muted ? "Son coupé" : "Son rétabli");
        break;
      case "c":
        toggleCaptions();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "?":
        setShowHelp((v) => !v);
        break;
      case "Escape":
        setShowHelp(false);
        break;
    }
  };

  const coverage = watched.size / BUCKETS;
  const playedPct = duration ? (time / duration) * 100 : 0;

  // Watched buckets merged into continuous stretches for the seek bar.
  const watchedSegments = useMemo(() => {
    const segments: Array<[number, number]> = [];
    for (let b = 0; b < BUCKETS; b++) {
      if (!watched.has(b)) continue;
      const last = segments[segments.length - 1];
      if (last && last[1] === b) last[1] = b + 1;
      else segments.push([b, b + 1]);
    }
    return segments;
  }, [watched]);
  const hoverWatched = hover ? watched.has(Math.min(BUCKETS - 1, Math.floor(hover.ratio * BUCKETS))) : false;

  return (
    <div>
      <div
        ref={containerRef}
        role="region"
        aria-label="Lecteur vidéo"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative overflow-hidden bg-ink-900 focus-visible:outline-offset-4",
          fullscreen ? "flex h-full items-center" : "aspect-video rounded-2xl shadow-sm",
        )}
      >
        <video
          ref={videoRef}
          poster={source.type === "hls" ? source.poster : undefined}
          crossOrigin={source.captions ? "anonymous" : undefined}
          playsInline
          preload="metadata"
          controlsList="nodownload"
          disablePictureInPicture={false}
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePlay}
          onPlay={() => {
            setPlaying(true);
            setEnded(false);
          }}
          onPause={() => {
            setPlaying(false);
            void flush();
          }}
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
            void flush();
          }}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onSeeking={() => {
            seeking.current = true;
          }}
          onSeeked={() => {
            seeking.current = false;
            lastTime.current = videoRef.current?.currentTime ?? null;
          }}
          onVolumeChange={() => {
            setMuted(videoRef.current?.muted ?? false);
            setVolume(videoRef.current?.volume ?? 1);
          }}
          onError={() => setError(true)}
          className="h-full w-full bg-black object-contain"
        >
          {source.captions ? <track kind="subtitles" src={source.captions} srcLang="fr" label="Français" /> : null}
        </video>

        {captionsOn && cue && !ended ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 flex justify-center px-6 transition-[bottom] duration-200",
              playing ? "bottom-6 group-focus-within:bottom-24 group-hover:bottom-24" : "bottom-24",
            )}
          >
            <p className="max-w-3xl whitespace-pre-line rounded-md bg-black/75 px-3 py-1.5 text-center text-body font-medium leading-snug text-white sm:text-reading">
              {cue}
            </p>
          </div>
        ) : null}

        {flash ? (
          <div
            key={flash.key}
            aria-hidden
            className="animate-fade-up pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/70 px-3.5 py-1.5 text-label font-semibold text-white"
          >
            {flash.text}
          </div>
        ) : null}

        {showHelp ? (
          <div
            role="dialog"
            aria-label="Raccourcis clavier"
            className="absolute inset-0 z-20 flex items-center justify-center bg-brand-900/85 p-4 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          >
            <div className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 text-ink-900 shadow-pop" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-body font-semibold">
                  <Keyboard className="size-4 text-accent-600" aria-hidden /> Raccourcis clavier
                </p>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  aria-label="Fermer"
                  className="flex size-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-label">
                {SHORTCUTS.map(([keys, action]) => (
                  <div key={keys} className="contents">
                    <dt>
                      <kbd className="tabular rounded border border-line bg-ink-25 px-1.5 py-0.5 text-caption font-semibold text-ink-700">
                        {keys}
                      </kbd>
                    </dt>
                    <dd className="text-ink-600">{action}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/90 p-6 text-center text-white">
            <p className="text-card font-semibold">La vidéo n’a pas pu être chargée.</p>
            <p className="max-w-sm text-label text-ink-300">Vérifiez votre connexion puis rechargez la page. Votre progression est conservée.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 rounded-md bg-white px-3.5 py-2 text-label font-medium text-ink-900 hover:bg-ink-100"
            >
              Recharger
            </button>
          </div>
        ) : null}

        {ended && !error ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-brand-900/85 p-6 text-center text-white backdrop-blur-sm">
            <p className="text-caption font-semibold uppercase tracking-wider text-accent-300">Vidéo terminée</p>
            {next ? (
              <Link
                href={next.href}
                className="group flex max-w-md items-center gap-3 rounded-xl bg-white px-4 py-3 text-left text-ink-900 shadow-pop transition-transform hover:-translate-y-0.5"
              >
                <span className="min-w-0">
                  <span className="block text-caption text-ink-500">{next.kind === "quiz" ? "Ensuite : l’évaluation" : "Leçon suivante"}</span>
                  <span className="block truncate text-body font-semibold">{next.label}</span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white transition-transform group-hover:translate-x-0.5">
                  {next.kind === "quiz" ? <ClipboardCheck className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
                </span>
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = 0;
                void video.play();
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-medium text-white/80 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-4" aria-hidden /> Revoir la vidéo
            </button>
          </div>
        ) : null}

        {!playing && !error && !ended ? (
          <button
            onClick={togglePlay}
            className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-800 shadow-pop transition-transform hover:scale-105"
            aria-label={time > 0 ? "Reprendre la lecture" : "Lire la vidéo"}
          >
            <Play className="ml-1 size-7" fill="currentColor" aria-hidden />
          </button>
        ) : null}

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-10 text-white transition-opacity",
            playing ? "opacity-0 focus-within:opacity-100 group-hover:opacity-100" : "opacity-100",
          )}
        >
          <div
            className="relative mb-1 flex h-5 items-center"
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setHover({ ratio: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) });
            }}
            onPointerLeave={() => setHover(null)}
          >
            {/* Track: grey base, already-watched stretches lighter, played part drawn by the input. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
              {watchedSegments.map(([from, to]) => (
                <span key={from} className="absolute inset-y-0 bg-white/55" style={{ left: `${from}%`, width: `${to - from}%` }} />
              ))}
            </div>
            {hover && duration ? (
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-caption font-semibold text-white"
                style={{ left: `clamp(2.5rem, ${hover.ratio * 100}%, calc(100% - 2.5rem))` }}
              >
                <span className="tabular">{formatClock(hover.ratio * duration)}</span>
                {hoverWatched ? <span className="ml-1.5 font-normal text-white/70">· déjà vu</span> : null}
              </span>
            ) : null}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(time, duration || 0)}
              onChange={(e) => {
                if (videoRef.current) videoRef.current.currentTime = Number(e.target.value);
              }}
              aria-label="Position de lecture"
              aria-valuetext={`${formatClock(time)} sur ${formatClock(duration)}`}
              className="video-range video-seek relative h-5 w-full cursor-pointer appearance-none bg-transparent"
              style={{ ["--played" as string]: `${playedPct}%` }}
            />
          </div>
          <div className="flex items-center gap-1">
            <ControlButton label={playing ? "Pause" : "Lecture"} onClick={togglePlay}>
              {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
            </ControlButton>
            <ControlButton label="Reculer de 10 secondes" onClick={() => seekBy(-10)}>
              <RotateCcw className="size-[18px]" />
            </ControlButton>
            <ControlButton label="Avancer de 10 secondes" onClick={() => seekBy(10)}>
              <RotateCw className="size-[18px]" />
            </ControlButton>
            <ControlButton label={muted ? "Activer le son" : "Couper le son"} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (videoRef.current) {
                  videoRef.current.volume = v;
                  videoRef.current.muted = v === 0;
                }
              }}
              aria-label="Volume"
              className="video-range hidden h-5 w-20 cursor-pointer appearance-none bg-transparent sm:block"
              style={{ ["--played" as string]: `${(muted ? 0 : volume) * 100}%` }}
            />
            <span className="tabular ml-2 text-caption text-white/90">
              {formatClock(time)} / {formatClock(duration)}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {hasCaptions ? (
                <button
                  type="button"
                  onClick={toggleCaptions}
                  aria-label="Sous-titres"
                  aria-pressed={captionsOn}
                  title="Sous-titres (C)"
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline-white",
                    captionsOn && "text-accent-300",
                  )}
                >
                  <Captions className="size-[18px]" aria-hidden />
                  {captionsOn ? <span aria-hidden className="absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-accent-400" /> : null}
                </button>
              ) : null}
              <ControlButton label="Raccourcis clavier (?)" onClick={() => setShowHelp(true)}>
                <Keyboard className="size-[18px]" />
              </ControlButton>
              <Menu
                trigger={
                  <button
                    className="flex h-8 items-center gap-1 rounded-md px-2 text-caption font-semibold hover:bg-white/15"
                    aria-label={`Vitesse de lecture : ${rate}×`}
                  >
                    <Gauge className="size-4" aria-hidden /> {rate}×
                  </button>
                }
              >
                <MenuLabel>Vitesse de lecture</MenuLabel>
                {SPEEDS.map((s) => (
                  <MenuItem key={s} onSelect={() => changeRate(s)}>
                    <span className={cn("tabular", s === rate && "font-semibold text-accent-700")}>
                      {s === 1 ? "Normale" : `${s}×`}
                    </span>
                  </MenuItem>
                ))}
              </Menu>
              <ControlButton label={fullscreen ? "Quitter le plein écran" : "Plein écran"} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
              </ControlButton>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-ink-500">
        <span>
          Contenu visionné : <span className="tabular font-medium text-ink-700">{Math.round(coverage * 100)} %</span>
          {" · "}la leçon est validée à {Math.round(completionThreshold * 100)} %
        </span>
        {syncError ? (
          <span role="status" className="text-warning-700">
            Synchronisation interrompue — nouvelle tentative automatique.
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="hidden items-center gap-1.5 rounded-md text-ink-500 hover:text-ink-800 sm:inline-flex"
          >
            <Keyboard className="size-3.5" aria-hidden /> Raccourcis clavier : appuyez sur
            <kbd className="rounded border border-line bg-ink-25 px-1 text-caption font-semibold">?</kbd>
          </button>
        )}
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md hover:bg-white/15 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}
