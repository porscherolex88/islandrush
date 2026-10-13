"use client";

import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type BoxStop = { level: number; state: "current" | "open" | "locked"; name: string; art: string };

/** Every level's chest on one swipeable path, with the level being viewed centred and a segmented bar above. */
export function BoxPath({ stops, active }: { stops: BoxStop[]; active: number }) {
  const list = useRef<HTMLOListElement>(null);
  const current = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const el = current.current;
    const box = list.current;
    if (el && box) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, [active]);

  return (
    <nav aria-label="Mystery Box levels">
      <p className="font-heading text-lg leading-none font-extrabold tabular">
        Level {active} <span className="text-sm text-muted-foreground">of {stops.length}</span>
      </p>
      <ol aria-hidden className="mt-1.5 flex gap-1">
        {stops.map((s) => (
          <li
            key={s.level}
            className={cn("h-1.5 flex-1 rounded-full", s.level === active ? "bg-gold" : s.state === "locked" ? "bg-muted" : "bg-primary/40")}
          />
        ))}
      </ol>
      <ol ref={list} className="relative -mx-4 mt-2 flex snap-x items-center overflow-x-auto px-4 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stops.map((s, i) => {
          const isActive = s.level === active;
          return (
            <Fragment key={s.level}>
              {i > 0 && <li aria-hidden className={cn("mb-4 w-2.5 shrink-0 border-t-[3px] border-dotted", s.state === "locked" ? "border-border" : "border-primary/40")} />}
              <li ref={isActive ? current : undefined} className="shrink-0 snap-center">
                <Link
                  href={`/play/mystery-box?level=${s.level}`}
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={`Level ${s.level}, ${s.name}: ${s.state === "locked" ? "locked" : "open"}`}
                  className="flex flex-col items-center gap-1 rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "relative block size-14 rounded-2xl transition-transform active:scale-95",
                      isActive ? "bg-gold-soft ring-[3px] ring-gold" : s.state === "locked" ? "bg-muted" : "bg-surface",
                    )}
                  >
                    <Image src={s.art} alt="" fill sizes="56px" className={cn("object-contain p-1.5", s.state === "locked" && "opacity-55 saturate-50")} />
                    {s.state === "locked" && (
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid size-7 place-items-center rounded-full bg-foreground/70 text-background">
                          <Lock className="size-3.5" aria-hidden />
                        </span>
                      </span>
                    )}
                  </span>
                  <span className={cn("text-[11px] leading-none font-bold tabular", isActive ? "text-foreground" : "text-muted-foreground")}>Lv {s.level}</span>
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
