"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LandingButton } from "@/components/public/marketing";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
  const href = promo.link ?? (signedIn ? "/app" : "/register");
  const cta = href === "/register" ? "Claim my free spin" : href.startsWith("/app") ? "Open the app" : "Take a look";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-3xl border-0 bg-ocean-deep p-0 text-white ring-white/10 sm:max-w-md [&_[data-slot=dialog-close]]:text-white/80 [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-white">
        <div className="relative h-44 bg-[radial-gradient(circle_at_50%_70%,oklch(0.8_0.16_80/0.55),transparent_60%)]">
          <motion.div
            className="absolute inset-x-0 top-3 mx-auto aspect-square w-40"
            initial={reduced ? false : { scale: 0.4, rotate: -14, y: 40, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 13, delay: 0.08 }}
          >
            <Image src="/illustrations/3d/gift.webp" alt="" fill sizes="160px" className="object-contain drop-shadow-[0_18px_24px_rgb(0_0_0/0.45)]" />
          </motion.div>
        </div>
        <div className="px-6 pb-6 text-center">
          <DialogTitle className="font-heading text-2xl font-extrabold tracking-tight">{promo.title}</DialogTitle>
          {promo.body && <DialogDescription className="mt-2 text-white/75">{promo.body}</DialogDescription>}
          <LandingButton asChild className="mt-5 w-full">
            <Link href={href} onClick={() => setOpen(false)}>
              {cta}
            </Link>
          </LandingButton>
          <p className="mt-3 text-xs text-white/50">18+ only. Play responsibly.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
