"use client";

import { motion, useReducedMotion } from "motion/react";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatCredits } from "@/lib/money";
import { rarityOf } from "@/lib/rarity";
import { claimEventAction, claimLoginAction, claimMissionBonusAction, spinAction } from "@/server/actions/games";
import type { PoolOdds } from "@/server/services/mystery-box";
import type { RewardResult } from "@/server/services/rewards";
import { RewardChip, RewardReveal } from "./reward-reveal";

export function CheckInCard({ claimed, streak }: { claimed: boolean; streak: number }) {
  const [reveal, setReveal] = useState<{ rewards: RewardResult[]; title: string; xp: number } | null>(null);
  const { run, pending } = useAction(claimLoginAction, {
    onSuccess: (d) => {
      if (d.milestoneRewards.length) {
        const m = d.milestoneRewards[d.milestoneRewards.length - 1];
        setReveal({ rewards: d.milestoneRewards.flatMap((x) => x.rewards), title: `🔥 ${m.days}-day streak: ${m.title}`, xp: d.xp });
      } else {
        toast.success(`Checked in! ${d.streak}-day streak${d.xp ? `, +${d.xp} XP` : ""}`);
      }
    },
  });
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-2xl" aria-hidden>
        👋
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Daily check-in</p>
        <p className="text-xs text-muted-foreground">{claimed ? `Done. ${streak}-day streak` : "Keep your streak alive"}</p>
      </div>
      <Button onClick={() => run()} disabled={claimed || pending} size="lg" className="rounded-full px-4">
        {pending && <Loader2 className="animate-spin" />}
        {claimed ? "Checked in" : "Check in"}
      </Button>
      <RewardReveal open={Boolean(reveal)} onClose={() => setReveal(null)} title={reveal?.title} rewards={reveal?.rewards ?? []} xp={reveal?.xp} />
    </div>
  );
}

const WHEEL_COLORS = ["#ede9fe", "#fef3c7", "#e0f2fe", "#dcfce7", "#fce7f3", "#ffedd5", "#e0e7ff", "#f1f5f9"];

export function SpinWheel({
  entries,
  spun,
  available,
  boosted,
}: {
  entries: PoolOdds;
  spun: RewardResult | null;
  available: boolean;
  boosted: boolean;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ reward: RewardResult; xp: number } | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const segs = entries.slice(0, 10);
  const seg = 360 / Math.max(1, segs.length);
  const { run, pending } = useAction(spinAction, {
    refresh: false,
    onSuccess: (d) => {
      const idx = Math.max(0, segs.findIndex((e) => e.id === d.entryId));
      const target = 360 * 6 + (360 - (idx * seg + seg / 2));
      setResult({ reward: d.reward, xp: d.xp });
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
    return `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
  };

  return (
    <div className="flex flex-col items-center">
      {boosted && (
        <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
          <Sparkles className="size-3.5" /> Streak Spin: boosted rewards
        </p>
      )}
      <div className="relative size-64">
        <div aria-hidden className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-primary drop-shadow" />
        <motion.svg
          viewBox="-125 -125 250 250"
          className="size-full drop-shadow-xl"
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
          <circle r="124" fill="#7c3aed" />
          {segs.map((e, i) => {
            const mid = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
            return (
              <g key={e.id}>
                <path d={arc(i)} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#fff" strokeWidth="2" />
                <text
                  x={Math.cos(mid) * 78}
                  y={Math.sin(mid) * 78}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="22"
                  transform={`rotate(${i * seg + seg / 2} ${Math.cos(mid) * 78} ${Math.sin(mid) * 78})`}
                >
                  {e.icon}
                </text>
              </g>
            );
          })}
          <circle r="22" fill="#fff" stroke="#7c3aed" strokeWidth="4" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="18">
            🎡
          </text>
        </motion.svg>
      </div>
      <div className="mt-4 w-full">
        {done ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Today&apos;s spin</p>
            <div className="mt-1 flex justify-center">
              <RewardChip reward={(result?.reward ?? spun)!} className="text-sm" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Your next spin unlocks tomorrow.</p>
          </div>
        ) : (
          <Button size="xl" className="w-full" onClick={() => run()} disabled={!available || pending || spinning}>
            {(pending || spinning) && <Loader2 className="animate-spin" />}
            {!available ? "Spin unavailable today" : pending || spinning ? "Spinning..." : "Spin now, it's free"}
          </Button>
        )}
      </div>
      <details className="mt-3 w-full text-sm">
        <summary className="cursor-pointer text-center text-xs font-semibold text-muted-foreground">View spin odds</summary>
        <ul className="mt-2 divide-y rounded-xl border">
          {segs.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-3 py-2">
              <span className="flex items-center gap-2">
                <span aria-hidden>{e.icon}</span>
                {e.label}
              </span>
              <span className={`text-xs font-semibold ${rarityOf(e.rarity).text}`}>{e.pct.toFixed(e.pct < 1 ? 2 : 1)}%</span>
            </li>
          ))}
        </ul>
      </details>
      <RewardReveal
        open={revealOpen}
        onClose={() => {
          setRevealOpen(false);
          router.refresh();
        }}
        title="Daily Spin" rewards={result ? [result.reward] : []} xp={result?.xp} />
    </div>
  );
}

export function MissionBonusButton({ done, total, claimed }: { done: number; total: number; claimed: boolean }) {
  const [reveal, setReveal] = useState<{ rewards: RewardResult[]; xp: number } | null>(null);
  const { run, pending } = useAction(claimMissionBonusAction, { onSuccess: (d) => setReveal(d) });
  const ready = done >= total && total > 0;
  return (
    <>
      <Button size="xl" variant={ready && !claimed ? "gold" : "secondary"} className="w-full" disabled={!ready || claimed || pending} onClick={() => run()}>
        {pending && <Loader2 className="animate-spin" />}
        {claimed ? "Mission reward claimed" : ready ? "Claim mission reward 🎁" : `Complete all missions (${done}/${total})`}
      </Button>
      <RewardReveal open={Boolean(reveal)} onClose={() => setReveal(null)} title="All missions complete" rewards={reveal?.rewards ?? []} xp={reveal?.xp} />
    </>
  );
}

export function MysteryEventCard({
  event,
  claim,
}: {
  event: { title: string; description: string; icon: string; costCredits: number } | null;
  claim: RewardResult | null;
}) {
  const [reveal, setReveal] = useState<{ reward: RewardResult; xp: number } | null>(null);
  const { run, pending } = useAction(claimEventAction, { onSuccess: (d) => setReveal(d) });
  if (!event) {
    return <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">No mystery event today. Check back tomorrow.</p>;
  }
  const current = reveal?.reward ?? claim;
  return (
    <div className="overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,oklch(0.96_0.04_220),oklch(0.99_0.01_200))] p-4">
      <div className="flex gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow-card" aria-hidden>
          {event.icon}
        </div>
        <div>
          <p className="font-heading text-lg font-bold">{event.title}</p>
          <p className="text-sm text-muted-foreground">{event.description}</p>
        </div>
      </div>
      <div className="mt-4">
        {current ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">You found</span>
            <RewardChip reward={current} />
          </div>
        ) : (
          <Button size="xl" className="w-full" onClick={() => run()} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {event.costCredits > 0 ? `Explore for ${formatCredits(event.costCredits)} Credits` : "Explore for free"}
          </Button>
        )}
      </div>
      <RewardReveal open={Boolean(reveal)} onClose={() => setReveal(null)} title={event.title} rewards={reveal ? [reveal.reward] : []} xp={reveal?.xp} />
    </div>
  );
}
