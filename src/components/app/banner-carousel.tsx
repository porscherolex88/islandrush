"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CarouselBanner = { id: string; title: string; body: string | null; link: string | null };

const INTERVAL_MS = 5000;
/** How long autoplay waits after the user swipes or taps a dot before resuming. */
const RESUME_AFTER_MS = 8000;

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function Slide({ banner, index, count }: { banner: CarouselBanner; index: number; count: number }) {
  const body = (
    <>
      <span className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/70 text-gold-foreground" aria-hidden>
          <Megaphone className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gold-foreground">{banner.title}</span>
          {banner.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{banner.body}</span>}
        </span>
      </span>
    </>
  );
  const cls = "flex h-full flex-col rounded-2xl border border-gold/40 bg-gold-soft p-3.5";
  const external = banner.link && !banner.link.startsWith("/");

  return (
    <div role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}`} className="h-full">
      {banner.link ? (
        external ? (
          <a href={banner.link} target="_blank" rel="noopener noreferrer" className={cn(cls, "transition-colors hover:bg-amber-100", focusRing)}>
            {body}
          </a>
        ) : (
          <Link href={banner.link} className={cn(cls, "transition-colors hover:bg-amber-100", focusRing)}>
            {body}
          </Link>
        )
      ) : (
        <div className={cls}>{body}</div>
      )}
    </div>
  );
}

/**
 * Home announcements as a swipeable strip. Auto-advances and loops, pausing while the
 * user hovers, focuses or touches it, and never auto-moves under reduced motion.
 */
export function BannerCarousel({ banners }: { banners: CarouselBanner[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interactedAt, setInteractedAt] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tick, setTick] = useState(0);
  const count = banners.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft - 16, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);

  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    let nearest = 0;
    let best = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft - el.offsetLeft - 16 - el.scrollLeft);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  const autoplay = count > 1 && !hovered && !focused && !reducedMotion;

  useEffect(() => {
    if (!autoplay) return;
    const wait = Math.max(INTERVAL_MS, interactedAt + RESUME_AFTER_MS - Date.now());
    const id = window.setTimeout(() => {
      if (document.visibilityState === "visible") goTo((active + 1) % count);
      else setTick((t) => t + 1);
    }, wait);
    return () => window.clearTimeout(id);
  }, [autoplay, active, count, goTo, interactedAt, tick]);

  if (count === 0) return null;
  if (count === 1) {
    return (
      <div className="px-4">
        <Slide banner={banners[0]} index={0} count={1} />
      </div>
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Announcements"
      className="mb-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        ref={track}
        onScroll={onScroll}
        onPointerDown={() => setInteractedAt(Date.now())}
        onTouchStart={() => setInteractedAt(Date.now())}
        aria-live={autoplay ? "off" : "polite"}
        className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => (
          <div key={b.id} className="w-[86%] shrink-0 snap-start">
            <Slide banner={b} index={i} count={count} />
          </div>
        ))}
      </div>

      <div className="flex h-8 items-center justify-center px-4">
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setInteractedAt(Date.now());
              goTo(i);
            }}
            className={cn("grid h-8 w-4 place-items-center rounded-full", focusRing)}
            aria-label={`Show announcement ${i + 1} of ${count}`}
            aria-current={i === active ? "true" : undefined}
          >
            <span className={cn("block size-2 rounded-full transition-colors", i === active ? "bg-gold" : "bg-border")} aria-hidden />
          </button>
        ))}
      </div>
    </section>
  );
}
