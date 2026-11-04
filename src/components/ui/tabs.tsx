"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs as RadixTabs } from "radix-ui";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Each tab carries its own orange border so the active one is marked before
 * hydration. Once the sliding indicator is measured, the list gets
 * `data-ready` and the active tab's border hides behind it.
 */
const tabClass = (active: boolean) =>
  cn(
    "relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-body font-medium transition-colors",
    active
      ? "border-accent-600 text-ink-900 group-data-[ready]/tabs:border-transparent"
      : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800",
  );

/** Follows the active tab (matched by `selector`) and returns where the underline goes. */
function useIndicator<T extends HTMLElement>(selector: string) {
  const listRef = useRef<T>(null);
  const [box, setBox] = useState<{ x: number; width: number } | null>(null);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>(selector);
      setBox(active ? { x: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    // Resizes (fonts, counts) and tab changes (Radix state, route change) both move it.
    const resize = new ResizeObserver(measure);
    resize.observe(list);
    const mutation = new MutationObserver(measure);
    mutation.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state", "aria-current"] });
    // Placed first without a transition, so it never slides in from the left edge.
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => {
      resize.disconnect();
      mutation.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [selector]);

  const indicator = box ? (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-accent-600",
        animated && "transition-[translate,width] duration-300 ease-out motion-reduce:transition-none",
      )}
      style={{ width: box.width, translate: `${box.x}px 0` }}
    />
  ) : null;

  return { listRef, ready: box !== null, indicator };
}

/** Route-based tabs (each tab is a URL). */
export function LinkTabs({
  items,
  exact = false,
  activeHref,
  className,
}: {
  items: Array<{ href: string; label: ReactNode; count?: number; exact?: boolean }>;
  exact?: boolean;
  /** Explicit active item (for tabs that differ only by query string). */
  activeHref?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const { listRef, ready, indicator } = useIndicator<HTMLUListElement>('[aria-current="page"]');
  return (
    <nav aria-label="Sections" className={cn("border-b border-line", className)}>
      <ul ref={listRef} data-ready={ready || undefined} className="group/tabs relative -mb-px flex gap-6 overflow-x-auto overflow-y-hidden">
        {items.map((item) => {
          const exactMatch = item.exact ?? exact;
          const active =
            activeHref !== undefined
              ? item.href === activeHref
              : exactMatch
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {item.label}
                {item.count !== undefined ? (
                  <span className="tabular rounded-sm bg-ink-100 px-1.5 text-caption text-ink-600">{item.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {indicator ? (
          <li aria-hidden className="contents">
            {indicator}
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/** In-page tabs (Radix: arrow-key navigation, ARIA roles). */
export function Tabs({
  defaultValue,
  items,
  className,
}: {
  defaultValue: string;
  items: Array<{ value: string; label: ReactNode; content: ReactNode }>;
  className?: string;
}) {
  const { listRef, ready, indicator } = useIndicator<HTMLDivElement>('[data-state="active"]');
  return (
    <RadixTabs.Root defaultValue={defaultValue} className={className}>
      <RadixTabs.List
        ref={listRef}
        data-ready={ready || undefined}
        className="group/tabs relative flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line"
        aria-label="Sections"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              tabClass(false),
              "data-[state=active]:border-accent-600 data-[state=active]:text-ink-900 data-[state=active]:group-data-[ready]/tabs:border-transparent",
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
        {indicator}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="pt-5 focus-visible:outline-none">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
