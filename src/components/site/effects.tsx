"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Signature effects of the public site. All of them are progressive
 * enhancements: the server renders the finished state, and only once
 * JavaScript runs — and the visitor accepts motion — is the element put in a
 * "pending" state and then played when it scrolls into view (see globals.css,
 * section « Signature effects »).
 */

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * data-inview: absent (finished state: server render, no JS, reduced motion)
 * → "pending" once JavaScript runs → "shown" the first time it enters the viewport.
 * One-shot effects (confetti) key on "shown" only, so they never play without JS.
 */
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"shown" | "pending" | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    setState("pending");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, state] as const;
}

/** Container whose CSS animations play once it is in view. */
export function InView({
  as: Tag = "div",
  threshold,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  threshold?: number;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  const [ref, state] = useInView<HTMLElement>(threshold);
  return (
    <Tag ref={ref} data-inview={state} className={className} {...rest}>
      {children}
    </Tag>
  );
}

/** A teacher's highlighter stroke drawn behind the words when they come into view. */
export function Highlight({ children, tone = "light", className }: { children: ReactNode; tone?: "light" | "dark"; className?: string }) {
  const [ref, state] = useInView<HTMLSpanElement>(0.8);
  return (
    <span ref={ref} data-inview={state} className={cn("highlighter", tone === "dark" && "highlighter-dark", className)}>
      {children}
    </span>
  );
}

/**
 * Soft light that follows the pointer across its parent (dark sections).
 * Fine pointers only; nothing on touch screens or with reduced motion.
 */
export function PointerGlow({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = parent.getBoundingClientRect();
        el.style.setProperty("--gx", `${e.clientX - r.left}px`);
        el.style.setProperty("--gy", `${e.clientY - r.top}px`);
        el.style.opacity = "1";
      });
    };
    const leave = () => (el.style.opacity = "0");
    parent.addEventListener("pointermove", move);
    parent.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      parent.removeEventListener("pointermove", move);
      parent.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <div ref={ref} aria-hidden className={cn("pointer-glow pointer-events-none absolute inset-0", className)} />;
}

/** Gentle 3D tilt toward the pointer (fine pointers only). */
export function Tilt({ max = 5, className, children }: { max?: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1100px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      el.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return (
    <div ref={ref} className={cn("transition-transform duration-500 ease-[var(--ease-out-strong)] [transform-style:preserve-3d]", className)}>
      {children}
    </div>
  );
}
