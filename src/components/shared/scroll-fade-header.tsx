"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky header that is fully transparent at the top of the page and fades to a
 * solid background once its scroll container moves.
 * Works whether the window scrolls (mobile) or an ancestor does (desktop phone frame);
 * scrolls inside unrelated elements, like a horizontal carousel, are ignored.
 */
export function ScrollFadeHeader({
  children,
  className,
  tint = "var(--background)",
  as: Tag = "header",
}: {
  children: ReactNode;
  className?: string;
  /** Background color once scrolled. */
  tint?: string;
  as?: "header" | "div";
}) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = (target: EventTarget | null) => {
      if (target instanceof Element && target !== document.scrollingElement) {
        if (!target.contains(el)) return;
        setScrolled(target.scrollTop > 4);
      } else {
        setScrolled(window.scrollY > 4);
      }
    };
    const onScroll = (e: Event) => read(e.target);
    let node: Element | null = el.parentElement;
    while (node && !(node.scrollTop > 0)) node = node.parentElement;
    read(node ?? document);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  return (
    <Tag ref={ref as never} className={cn("sticky top-0 isolate", className)}>
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 ease-out", scrolled ? "opacity-100" : "opacity-0")}
        style={{ backgroundColor: tint }}
      />
      {children}
    </Tag>
  );
}
