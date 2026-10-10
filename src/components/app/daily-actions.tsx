"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Flame, Gift, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { claimEventAction, claimLoginAction, claimMissionBonusAction, spinAction } from "@/server/actions/games";
import type { PoolOdds } from "@/server/services/mystery-box";
import type { RewardResult } from "@/server/services/rewards";
import { ART } from "./art";
import { OddsSheet } from "./odds-sheet";
import { RewardChip, RewardReveal } from "./reward-reveal";

export function CheckInCard({ claimed, streak }: { claimed: boolean; streak: number }) {
  return (
    <div className="relative isolate flex flex-col overflow-hidden rounded-2xl border border-orange-200 bg-[linear-gradient(160deg,oklch(0.98_0.03_75),oklch(0.93_0.07_60))] p-3">
      <Flame aria-hidden className="absolute -top-3 -right-4 -z-10 size-24 text-orange-400/20" strokeWidth={1.5} />
      <span className="grid size-11 place-items-center rounded-full bg-[linear-gradient(180deg,#fb923c,#ea580c)] text-white shadow-sm shadow-orange-600/30" aria-hidden>
        <Flame className="size-6" />
      </span>
      <p className="mt-3 font-heading text-lg leading-tight font-extrabold text-orange-950">Daily check-in</p>
      <p className="mt-1 mb-3 text-sm text-orange-900/75">
        {claimed ? `${streak}-day streak. See you tomorrow!` : streak > 0 ? `Keep your ${streak}-day streak going.` : "Start a new streak today."}
      </p>
      <div className="mt-auto">
        <CheckInButton claimed={claimed} streak={streak} compact />
      </div>
    </div>
  );
}

export function CheckInButton({ claimed, streak, compact }: { claimed: boolean; streak: number; compact?: boolean }) {
  const [reveal, setReveal] = useState<{ rewards: RewardResult[]; title: string } | null>(null);
  const { run, pending } = useAction(claimLoginAction, {
    onSuccess: (d) => {
      if (d.milestoneRewards.length) {
        const m = d.milestoneRewards[d.milestoneRewards.length - 1];
        setReveal({ rewards: d.milestoneRewards.flatMap((x) => x.rewards), title: `${m.days}-day streak: ${m.title}` });
      } else {
        toast.success(`Checked in! ${d.streak}-day streak`);
      }
    },
  });
  return (
    <>
      <Button onClick={() => run()} disabled={claimed || pending} size="pill" variant={claimed ? "secondary" : "gold"} className={cn("w-full", claimed && "bg-emerald-100 text-emerald-800 disabled:opacity-100")}>
        {pending ? <Loader2 className="animate-spin" /> : claimed ? <Check /> : null}
        {compact ? (claimed ? "Checked in" : "Check in") : claimed ? `Checked in today · ${streak}-day streak` : "Check in to keep your streak"}
      </Button>
      <RewardReveal open={Boolean(reveal)} onClose={() => setReveal(null)} title={reveal?.title} rewards={reveal?.rewards ?? []} />
    </>
  );
}

/** Rounds SVG coordinates so server and browser render identical attribute strings. */
const px = (n: number) => Math.round(n * 1000) / 1000;

const WHEEL_COLORS = ["#0f5e6e", "#f6c453", "#13798a", "#fbe3a1", "#0b4f5c", "#f2b134", "#1a8fa1", "#fdf0c8"];

export function SpinWheel({ entries, spun, available, boosted }: { entries: PoolOdds; spun: RewardResult | null; available: boolean; boosted: boolean }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<RewardResult | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const segs = entries.slice(0, 10);
  const seg = 360 / Math.max(1, segs.length);
  const { run, pending } = useAction(spinAction, {
    refresh: false,
    onSuccess: (d) => {
      const idx = Math.max(0, segs.findIndex((e) => e.id === d.entryId));
      const target = 360 * 6 + (360 - (idx * seg + seg / 2));
      setResult(d.reward);
      setSpinning(true);
      setRotation(target);
      if (reduce) {
        setSpinning(false);
        setRevealOpen(true);
      }
    },
  });

  const done = Boolean(spun) || Boolean(result);
  const r = 120;
  const arc = (i: number) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    const large = seg > 180 ? 1 : 0;
    return `M0 0 L${px(r * Math.cos(a0))} ${px(r * Math.sin(a0))} A${r} ${r} 0 ${large} 1 ${px(r * Math.cos(a1))} ${px(r * Math.sin(a1))} Z`;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center gap-2">
        {!done && available && <span className="rounded-full bg-success px-3 py-1 text-xs font-extrabold text-white">Free</span>}
        {boosted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
            <Sparkles className="size-3.5" /> Streak Spin: boosted rewards
          </span>
        )}
      </div>
      <div className="relative aspect-square w-full max-w-72">
        <div aria-hidden className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent border-t-amber-400" />
        <motion.svg
          viewBox="-130 -130 260 260"
          className="size-full"
          animate={{ rotate: rotation }}
          transition={reduce ? { duration: 0 } : { duration: 4.2, ease: [0.12, 0.8, 0.2, 1] }}
          onAnimationComplete={() => {
            if (spinning) {
              setSpinning(false);
              setRevealOpen(true);
            }
          }}
          role="img"
          aria-label="Daily Spin wheel"
        >
          <circle r="129" fill="#b7791f" />
          <circle r="124" fill="#f6c453" />
          {segs.map((e, i) => {
            const mid = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
            return (
              <g key={e.id}>
                <path d={arc(i)} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#fff7e0" strokeWidth="2" />
                <text x={px(Math.cos(mid) * 80)} y={px(Math.sin(mid) * 80)} textAnchor="middle" dominantBaseline="central" fontSize="24" transform={`rotate(${px(i * seg + seg / 2)} ${px(Math.cos(mid) * 80)} ${px(Math.sin(mid) * 80)})`}>
                  {e.icon}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 16 }).map((_, i) => (
            <circle key={i} cx={px(Math.cos((i / 16) * Math.PI * 2) * 126)} cy={px(Math.sin((i / 16) * Math.PI * 2) * 126)} r="2.6" fill="#fff7e0" />
          ))}
          <circle r="26" fill="#0b4f5c" stroke="#f6c453" strokeWidth="5" />
          <circle r="9" fill="#f6c453" />
        </motion.svg>
      </div>
      <div className="mt-4 w-full">
        {done ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Today&apos;s spin</p>
            <div className="mt-1 flex justify-center">
              <RewardChip reward={(result ?? spun)!} className="text-sm" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Your next free spin unlocks tomorrow.</p>
          </div>
        ) : (
          <Button size="pill" variant="gold" className="w-full" onClick={() => run()} disabled={!available || pending || spinning}>
            {(pending || spinning) && <Loader2 className="animate-spin" />}
            {!available ? "Spin unavailable today" : pending || spinning ? "Spinning..." : "Spin"}
          </Button>
        )}
      </div>
      <OddsSheet odds={segs} label="View prizes & odds" title="Spin prizes" description="The chance of each prize on today's free spin." className="mt-2" />
      <RewardReveal
        open={revealOpen}
        onClose={() => {
          setRevealOpen(false);
          router.refresh();
        }}
        title="Daily Spin"
        rewards={result ? [result] : []}
      />
    </div>
  );
}

export function MissionBonusButton({ done, total, claimed }: { done: number; total: number; claimed: boolean }) {
  const [reveal, setReveal] = useState<{ rewards: RewardResult[] } | null>(null);
  const { run, pending } = useAction(claimMissionBonusAction, { onSuccess: (d) => setReveal(d) });
  const ready = done >= total && total > 0;
  return (
    <>
      <Button size="pill" variant={ready && !claimed ? "gold" : "secondary"} className="w-full" disabled={!ready || claimed || pending} onClick={() => run()}>
        {pending ? <Loader2 className="animate-spin" /> : claimed ? <Check /> : <Gift />}
        {claimed ? "Mission reward claimed" : ready ? "Claim mission reward" : `Finish all ${total} missions for a bonus`}
      </Button>
      <RewardReveal open={Boolean(reveal)} onClose={() => setReveal(null)} title="All missions complete" rewards={reveal?.rewards ?? []} />
    </>
  );
}

export function MysteryEventCard({ event, claim }: { event: { title: string; description: string; icon: string; costCredits: number } | null; claim: RewardResult | null }) {
  const [reveal, setReveal] = useState<{ reward: RewardResult } | null>(null);
  const { run, pending } = useAction(claimEventAction, { onSuccess: (d) => setReveal(d) });
  if (!event) {
    return <p className="rounded-3xl border border-dashed p-5 text-center text-sm text-muted-foreground">No mystery today. Check back tomorrow.</p>;
  }
  const current = reveal?.reward ?? claim;
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-ocean-deep text-white">
      <Image src={ART.tidePool} alt="" fill sizes="(max-width: 430px) 100vw, 430px" className="-z-10 object-cover" />
      <div aria-hidden className="art-scrim absolute inset-0 -z-10" />
      <div className="flex min-h-56 flex-col justify-end p-5">
        <p className="text-xs font-bold text-amber-200">Today&apos;s mystery</p>
        <p className="max-w-[70%] font-heading text-2xl font-extrabold">{event.title}</p>
        <p className="max-w-[65%] text-sm text-white/85">{event.description}</p>
        <div className="mt-4">
          {current ? (
            <div className="flex w-fit items-center gap-2 rounded-full bg-white/15 py-1 pr-1 pl-3 backdrop-blur">
              <span className="text-sm">You found</span>
              <RewardChip reward={current} />
            </div>
          ) : (
            <Button size="pill" variant="gold" className={cn("w-full max-w-60")} onClick={() => run()} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {event.costCredits > 0 ? `Explore for ${formatCredits(event.costCredits)} Credits` : "Explore for free"}
            </Button>
          )}
        </div>
      </div>
      <RewardReveal open={Boolean(reveal)} onClose={() => setReveal(null)} title={event.title} rewards={reveal ? [reveal.reward] : []} />
    </div>
  );
}
