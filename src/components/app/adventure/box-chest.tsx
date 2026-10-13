"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { RewardGlyph } from "./prizes-list";

export type ChestStage = "idle" | "unlocking" | "opened";

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = -Math.PI / 2 + ((i / 13) * 2 - 1) * 1.25;
  const dist = 70 + (i % 4) * 22;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 4 + (i % 3) * 2, delay: (i % 5) * 0.04 };
});

/**
 * The chest on the Mystery Box stage. It bobs while waiting, shakes with a glowing lock while the
 * server decides, then bursts open with a flash, light rays and sparks. `prize` floats out of the
 * open chest once the reel has landed.
 */
export function BoxChest({
  closed,
  open,
  name,
  stage,
  playable,
  locked,
  prize,
  className,
}: {
  closed: string;
  /** Square open-chest art aligned with `closed` (see `boxOpenArt`), or null for custom artwork. */
  open: string | null;
  name: string;
  stage: ChestStage;
  playable: boolean;
  locked: boolean;
  prize: { type: string; icon: string; rarity: string | null } | null;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const opened = stage === "opened";
  const external = (src: string) => /^https?:/.test(src);

  return (
    <div className={cn("relative [container-type:size]", className)}>
      <div className="absolute inset-0 m-auto size-[min(100cqw,100cqh)]">
        <AnimatePresence>
          {opened && (
            <motion.div
              key="rays"
              aria-hidden
              className="absolute -inset-1/4"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1, rotate: reduce ? 0 : 360 }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 0.3 }, scale: { duration: 0.5, ease: "easeOut" }, rotate: { duration: 14, ease: "linear", repeat: Infinity } }}
              style={{
                background: "repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 244 200 / 0.32) 0deg 9deg, transparent 9deg 24deg)",
                maskImage: "radial-gradient(circle at 50% 50%, #000 12%, transparent 62%)",
                WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 12%, transparent 62%)",
              }}
            />
          )}
        </AnimatePresence>

        <motion.div
          className="absolute inset-0"
          animate={
            reduce
              ? undefined
              : stage === "unlocking"
                ? { rotate: [0, -4, 4, -3, 3, 0], y: 0, scale: [1, 1.03, 1] }
                : opened
                  ? { scale: [0.92, 1.1, 1], rotate: 0, y: 0 }
                  : playable
                    ? { y: [0, -8, 0], rotate: 0, scale: 1 }
                    : { y: 0, rotate: 0, scale: 1 }
          }
          transition={
            stage === "unlocking"
              ? { duration: 0.42, repeat: Infinity }
              : opened
                ? { duration: 0.45, ease: "easeOut" }
                : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <span aria-hidden className="absolute inset-x-[12%] bottom-[1%] h-[7%] rounded-[50%] bg-black/30 blur-md" />
          <div className={cn("absolute inset-x-[5.56%] top-0 bottom-[2.78%] transition-opacity duration-150", opened && open ? "opacity-0" : "opacity-100")}>
            <Image
              src={closed}
              alt={name}
              fill
              sizes="240px"
              priority
              unoptimized={external(closed)}
              className={cn("object-contain object-bottom drop-shadow-xl", locked && "opacity-80 saturate-50")}
            />
          </div>
          {open && (
            <Image
              src={open}
              alt=""
              aria-hidden
              fill
              sizes="260px"
              priority
              className={cn("object-contain drop-shadow-xl transition-opacity duration-150", opened ? "opacity-100" : "opacity-0")}
            />
          )}
          {stage === "unlocking" && !reduce && (
            <motion.span
              aria-hidden
              className="absolute top-[62%] left-1/2 size-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_236_160/0.95),rgb(255_200_80/0.4)_45%,transparent_70%)]"
              animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.25, 0.8] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
          {locked && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-black/55 ring-2 ring-white/30">
                <Lock className="size-6" aria-hidden />
              </span>
            </span>
          )}
        </motion.div>

        <AnimatePresence>
          {opened && !reduce && (
            <motion.div key="burst" aria-hidden className="pointer-events-none absolute inset-0">
              <motion.span
                className="absolute top-1/2 left-1/2 size-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fff,rgb(255_240_190/0.8)_30%,transparent_65%)]"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1.4, 1.8] }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
              {SPARKS.map((s, i) => (
                <motion.span
                  key={i}
                  className="absolute top-[48%] left-1/2 rounded-full bg-amber-100 shadow-[0_0_8px_#fde68a]"
                  style={{ width: s.size, height: s.size }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
                  transition={{ duration: 0.9, delay: 0.08 + s.delay, ease: "easeOut" }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {opened && prize && (
            <div className="pointer-events-none absolute inset-x-0 top-[33%] flex justify-center">
              <motion.div
                key="prize"
                className="rounded-3xl shadow-[0_0_32px_rgb(255_236_160/0.9)]"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.3 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              >
                <RewardGlyph type={prize.type} icon={prize.icon} rarity={prize.rarity} size="lg" />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
