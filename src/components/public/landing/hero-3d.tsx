"use client";

import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const LootBoxScene = dynamic(() => import("./loot-box-scene"), { ssr: false });

class WebGLBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function canRender3D() {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia("(min-width: 768px) and (hover: hover)").matches) return false;
  if ((navigator.hardwareConcurrency ?? 4) < 4) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const FLOATERS = [
  { src: "/illustrations/3d/coins.webp", className: "left-[-4%] bottom-[6%] w-[26%]", depth: 18, delay: 0.2 },
  { src: "/illustrations/3d/puzzle.webp", className: "right-[-2%] top-[4%] w-[20%]", depth: -24, delay: 0.35 },
  { src: "/illustrations/3d/gems.webp", className: "right-[2%] bottom-[2%] w-[24%]", depth: 14, delay: 0.5 },
];

/** Hero centrepiece: a tappable 3D chest on capable desktops, the rendered chest artwork everywhere else. */
export function Hero3D() {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [want3D, setWant3D] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [burst, setBurst] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced || !canRender3D()) return;
    const start = () => setWant3D(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1200);
    return () => clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const show3D = want3D && !failed;

  return (
    <div
      ref={box}
      className="relative mx-auto aspect-square w-full max-w-[520px]"
      onPointerMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div aria-hidden className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,oklch(0.82_0.16_80/0.55),transparent_65%)] blur-2xl animate-glow" />

      <div className={cn("absolute inset-[8%] transition-opacity duration-700", show3D && ready ? "opacity-0" : "opacity-100")}>
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }}
        >
          <Image src="/illustrations/3d/chest-burst.webp" alt="Treasure chest bursting with coins and gems" fill priority sizes="(min-width: 1024px) 440px, 80vw" className="object-contain drop-shadow-[0_30px_40px_rgb(2_20_28/0.55)] animate-bob" />
        </motion.div>
      </div>

      {show3D && (
        <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
          <WebGLBoundary onError={() => setFailed(true)}>
            <LootBoxScene burstKey={burst} active={visible} onReady={() => setReady(true)} />
          </WebGLBoundary>
          <button
            type="button"
            onClick={() => setBurst((n) => n + 1)}
            className="absolute inset-[18%] rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
            aria-label="Open the treasure chest"
          />
        </div>
      )}

      {FLOATERS.map((f) => (
        <motion.div
          key={f.src}
          aria-hidden
          className={cn("pointer-events-none absolute aspect-square", f.className)}
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1, x: tilt.x * f.depth, y: tilt.y * f.depth }}
          transition={{ opacity: { delay: f.delay + 0.3 }, scale: { type: "spring", stiffness: 140, damping: 12, delay: f.delay + 0.3 }, x: { type: "spring", stiffness: 60, damping: 15 }, y: { type: "spring", stiffness: 60, damping: 15 } }}
        >
          <Image src={f.src} alt="" fill sizes="140px" className="object-contain drop-shadow-[0_16px_20px_rgb(2_20_28/0.5)] animate-float" style={{ animationDelay: `${f.delay * -4}s` }} />
        </motion.div>
      ))}

      {show3D && ready && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-xs font-semibold text-white/70">Tap the chest</p>
      )}
    </div>
  );
}
