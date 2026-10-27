import { cn } from "@/lib/cn";

/*
 * Notebook doodles that draw themselves in the hero, like a teacher sketching
 * at the board: a light bulb (ideas), a star (success), a pencil, an open
 * book, a tick and a squiggle. Decorative only; drawn once, then they float.
 */
const DOODLES: Array<{ paths: string[]; className: string; delay: number; tone: "accent" | "white" }> = [
  {
    // Light bulb
    paths: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"],
    className: "left-[3%] top-[12%] size-14 rotate-[-12deg] sm:size-16",
    delay: 300,
    tone: "accent",
  },
  {
    // Star
    paths: ["M12 2.5l2.8 6.1 6.7.7-5 4.6 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.6 6.7-.7z"],
    className: "left-[44%] top-[8%] size-9 rotate-[14deg] hidden lg:block",
    delay: 700,
    tone: "white",
  },
  {
    // Pencil
    paths: ["M21.2 6.8a2.8 2.8 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z", "m15 5 4 4"],
    className: "bottom-[30%] left-[46%] size-11 rotate-[8deg] hidden lg:block",
    delay: 1100,
    tone: "white",
  },
  {
    // Open book
    paths: ["M12 7v14", "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"],
    className: "bottom-[16%] left-[2%] size-12 rotate-[10deg] hidden sm:block",
    delay: 1500,
    tone: "white",
  },
  {
    // Tick
    paths: ["M4 12.5l5 5L20 6.5"],
    className: "right-[3%] bottom-[22%] size-12 rotate-[-6deg] hidden lg:block",
    delay: 1900,
    tone: "accent",
  },
  {
    // Squiggle
    paths: ["M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-4 5-2"],
    className: "right-[38%] top-[4%] h-8 w-20 hidden lg:block",
    delay: 900,
    tone: "accent",
  },
];

export function HeroDoodles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {DOODLES.map((d, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("doodle absolute", d.tone === "accent" ? "stroke-accent-500/70" : "stroke-white/25", d.className)}
          style={{ "--doodle-delay": `${d.delay}ms` } as React.CSSProperties}
        >
          {d.paths.map((p) => (
            <path key={p} d={p} pathLength={1} />
          ))}
        </svg>
      ))}
    </div>
  );
}
