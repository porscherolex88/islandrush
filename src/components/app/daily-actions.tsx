"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Flame, Gift, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { claimLoginAction, claimMissionBonusAction, spinAction } from "@/server/actions/games";
import type { PrizeList } from "@/server/services/mystery-box";
import type { RewardResult } from "@/server/services/rewards";
import { PrizesSheet } from "./prizes-sheet";
import { RewardChip, RewardReveal } from "./reward-reveal";

export function CheckInCard({ claimed, streak }: { claimed: boolean; streak: number }) {
  return (
    <div className="relative isolate flex flex-col overflow-hidden rounded-2xl border border-orange-200 bg-[linear-gradient(160deg,var(--warm-soft),var(--gold-soft))] p-3">
      <Flame aria-hidden className="absolute -top-3 -right-4 -z-10 size-24 text-orange-400/20" strokeWidth={1.5} />
      <span className="grid size-11 place-items-center rounded-full bg-[linear-gradient(180deg,var(--color-orange-400),var(--color-orange-600))] text-white shadow-sm shadow-orange-600/30" aria-hidden>
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

const WHEEL_COLORS = ["var(--ocean-deep)", "var(--gold)", "var(--ocean)", "var(--gold-soft)"];

export function SpinWheel({ entries, spun, available, boosted }: { entries: PrizeList; spun: RewardResult | null; available: boolean; boosted: boolean }) {
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
      // Refresh mission progress as soon as the spin is recorded, not only after the reveal closes.
      router.refresh();
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
          <circle r="129" style={{ fill: "var(--gold-foreground)" }} />
          <circle r="124" style={{ fill: "var(--gold)" }} />
          {segs.map((e, i) => {
            const mid = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
            return (
              <g key={e.id}>
                <path d={arc(i)} style={{ fill: WHEEL_COLORS[i % WHEEL_COLORS.length], stroke: "var(--warm-soft)" }} strokeWidth="2" />
                <text x={px(Math.cos(mid) * 80)} y={px(Math.sin(mid) * 80)} textAnchor="middle" dominantBaseline="central" fontSize="24" transform={`rotate(${px(i * seg + seg / 2)} ${px(Math.cos(mid) * 80)} ${px(Math.sin(mid) * 80)})`}>
                  {e.icon}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 16 }).map((_, i) => (
            <circle key={i} cx={px(Math.cos((i / 16) * Math.PI * 2) * 126)} cy={px(Math.sin((i / 16) * Math.PI * 2) * 126)} r="2.6" style={{ fill: "var(--warm-soft)" }} />
          ))}
          <circle r="26" style={{ fill: "var(--ocean-deep)", stroke: "var(--gold)" }} strokeWidth="5" />
          <circle r="9" style={{ fill: "var(--gold)" }} />
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
      <PrizesSheet prizes={segs} label="View prizes" title="Spin prizes" description="Everything you can win on today's free spin." className="mt-2" />
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
