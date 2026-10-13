"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const fmt = new Intl.NumberFormat("en");

/** Counts up from zero the first time it scrolls into view. */
export function StatCounter({ value, label }: { value: number; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: reduced ? 0 : 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduced, value]);

  return (
    <div className="text-center">
      <span className="sr-only">
        {fmt.format(value)} {label}
      </span>
      <span ref={ref} aria-hidden className="block font-heading text-4xl font-extrabold tracking-tight tabular sm:text-5xl">
        {fmt.format(shown)}
      </span>
      <span aria-hidden className="mt-1 block text-sm text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
