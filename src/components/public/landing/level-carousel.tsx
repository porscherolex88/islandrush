"use client";

import { ChevronLeft, ChevronRight, Flag, Lock, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRef, type PointerEvent } from "react";
import { mapArt } from "@/components/app/art";
import { Button } from "@/components/ui/button";
import type { LandingMap } from "@/server/queries/landing";

function TiltCard({ m }: { m: LandingMap }) {
  const ref = useRef<HTMLLIElement>(null);
  const onMove = (e: PointerEvent<HTMLLIElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 10).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 12).toFixed(2)}deg`);
  };
  const reset = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  const first = m.level === 1;
  return (
    <li ref={ref} onPointerMove={onMove} onPointerLeave={reset} className="w-[78%] shrink-0 snap-start [perspective:900px] sm:w-[46%] lg:w-[31%]">
      <div className="relative isolate aspect-[4/5] overflow-hidden rounded-[1.75rem] text-white shadow-[0_24px_50px_-20px_rgb(10_11_13/0.35)] transition-transform duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]">
        <Image src={mapArt(m.level, m.artwork)} alt={`${m.name} map`} fill sizes="(min-width: 1024px) 360px, 78vw" className="-z-10 object-cover" />
        <div aria-hidden className="art-scrim-b absolute inset-0 -z-10" />
        <div className="flex items-center justify-between p-4">
          <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-bold backdrop-blur">Level {m.level}</span>
          {first ? (
            <span className="flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-bold text-[var(--gold-ink)]">
              <Sparkles className="size-3.5" aria-hidden /> Start here
            </span>
          ) : (
            <span className="relative grid size-8 place-items-center overflow-hidden rounded-full bg-white/20 backdrop-blur">
              <span aria-hidden className="shimmer absolute inset-0" />
              <Lock className="relative size-4" aria-label="Unlocks as you progress" />
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className="text-2xl font-extrabold">{m.name}</h3>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
            <span className="inline-flex items-center gap-1">
              <Flag className="size-3.5" aria-hidden /> {m.checkpoints} checkpoints
            </span>
            {m.lootRequired > 0 && <span>{m.lootRequired} Loot to unlock</span>}
          </p>
        </div>
      </div>
    </li>
  );
}

export function LevelCarousel({ maps }: { maps: LandingMap[] }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <div>
      <div className="mb-6 hidden justify-end gap-2 md:flex">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => scroll(-1)} aria-label="Previous levels">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => scroll(1)} aria-label="Next levels">
          <ChevronRight />
        </Button>
      </div>
      <ul ref={track} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pt-4 pb-12 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {maps.map((m) => (
          <TiltCard key={m.level} m={m} />
        ))}
      </ul>
    </div>
  );
}
