"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Seamless horizontal loop. Content is rendered twice and shifted by half its width,
 * so the duration controls speed regardless of item count.
 * Hover never pauses the strip. A small pause/play control satisfies WCAG 2.2.2.
 * Prefers-reduced-motion disables the animation (handled in globals.css) and hides the control.
 */
export function Marquee({
  children,
  className,
  duration = 40,
  label,
  controlClassName,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  label: string;
  /** Optional classes for the pause/play control (e.g. gold ticker contrast). */
  controlClassName?: string;
}) {
  const trackId = useId();
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className={cn("relative overflow-hidden mask-x-from-90% mask-x-to-100%", className)} role="region" aria-label={label}>
      <div
        id={trackId}
        className="flex w-max animate-marquee gap-0"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: paused || reducedMotion ? "paused" : "running",
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden inert>
          {children}
        </div>
      </div>
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-controls={trackId}
          aria-pressed={paused}
          aria-label={paused ? `Play ${label}` : `Pause ${label}`}
          className={cn(
            "absolute top-1/2 right-2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-opacity hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            controlClassName,
          )}
        >
          {paused ? <Play className="size-3.5 translate-x-px" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
        </button>
      )}
    </div>
  );
}
