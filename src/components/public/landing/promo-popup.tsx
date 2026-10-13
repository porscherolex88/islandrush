"use client";

import { XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { LandingButton } from "@/components/public/marketing";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { isAppPath } from "@/lib/app-routes";

export type Promo = { id: string; title: string; body: string | null; link: string | null };

const WELCOME: Promo = {
  id: "welcome",
  title: "Your first spin is on us",
  body: "Create a free account to claim today's daily spin and check-in reward, then start Level 1 of the adventure.",
  link: "/register",
};

const SEEN_KEY = "lootbox:promo-seen";
const DELAY_MS = 6000;
const SCROLL_TRIGGER = 0.4;

function seenIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** One promotion per visit, after a short delay or once the visitor scrolls 40% of the page. */
export function PromoPopup({ promos, signedIn }: { promos: Promo[]; signedIn: boolean }) {
  const reduced = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const pool = promos.length ? promos : signedIn ? [] : [WELCOME];
    const seen = seenIds();
    const next = pool.find((p) => !seen.includes(p.id));
    if (!next) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, next.id]));
      setPromo(next);
      setOpen(true);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) fire();
    };
    const timer = setTimeout(fire, DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [promos, signedIn]);

  if (!promo) return null;
  const href = promo.link ?? (signedIn ? "/home" : "/register");
  const cta = href === "/register" ? "Claim my free spin" : isAppPath(href) ? "Open the app" : "Take a look";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="bg-ink/55 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPrimitive.Content
          ref={contentRef}
          // The popup opens on a timer, so start focus on the panel instead of ringing the close button.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          className="fixed top-[calc(50%+2.5rem)] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 text-white outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 z-10 w-40 -translate-x-1/2">
            <motion.div
              className="relative aspect-[545/700]"
              initial={reduced ? false : { scale: 0.5, rotate: -12, y: 48, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 210, damping: 14, delay: 0.1 }}
            >
              <Image
                src="/illustrations/3d/gift.webp"
                alt=""
                fill
                sizes="160px"
                className="object-contain drop-shadow-[0_20px_22px_oklch(0.15_0.04_230/0.55)]"
              />
            </motion.div>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(180deg,var(--ocean)_0%,var(--ocean-deep)_55%)] px-7 pt-32 pb-6 text-center shadow-[0_30px_80px_-20px_oklch(0.15_0.05_230/0.8)] ring-1 ring-white/10">
            <div className="pointer-events-none absolute top-6 left-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2" aria-hidden>
              <motion.div
                className="size-full bg-[repeating-conic-gradient(rgb(255_255_255/0.14)_0deg_5deg,transparent_5deg_15deg)] [mask-image:radial-gradient(circle,black_0%,transparent_50%)]"
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ duration: 80, ease: "linear", repeat: Infinity }}
              />
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_60%_70%_at_50%_10%,rgb(255_255_255/0.28),transparent_70%)]"
              aria-hidden
            />

            <DialogPrimitive.Close className="absolute top-3.5 right-3.5 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-white/80 transition-colors outline-none hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <div className="relative">
              <DialogTitle className="font-heading text-[1.75rem] leading-[1.1] font-extrabold tracking-tight text-balance">
                {promo.title}
              </DialogTitle>
              {promo.body && (
                <DialogDescription className="mx-auto mt-3 max-w-[30ch] text-[0.95rem] leading-relaxed text-pretty text-white/70">
                  {promo.body}
                </DialogDescription>
              )}
              <LandingButton
                asChild
                className="mt-7 w-full bg-white bg-none text-primary shadow-[0_12px_28px_-10px_rgb(10_11_13/0.45)] hover:bg-white/90 hover:brightness-100 focus-visible:ring-white/60"
              >
                <Link href={href} onClick={() => setOpen(false)}>
                  {cta}
                </Link>
              </LandingButton>
              <p className="mt-4 text-xs text-white/45">18+ only. Play responsibly.</p>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
