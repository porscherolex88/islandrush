"use client";

import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/time";
import { unlockVaultAction } from "@/server/actions/games";
import type { RewardResult } from "@/server/services/rewards";
import { RequirementList, type RequirementView } from "./requirement-list";
import { RewardChip, RewardReveal } from "./reward-reveal";

export type VaultView = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  unlockRewards: RewardResult[];
  ready: boolean;
  progress: number;
  requirements: RequirementView[];
  prizes: { id: string; label: string; icon: string }[];
};

function VaultDoor({ state }: { state: "locked" | "ready" | "opening" | "open" }) {
  const reduce = useReducedMotion();
  const spinning = state === "opening";
  return (
    <div className="relative mx-auto size-48" aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fde68a,#d97706_60%,#92400e)] shadow-xl"
        animate={reduce ? undefined : state === "open" ? { rotateY: -70, x: -40, opacity: 0.35 } : { rotateY: 0, x: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
        style={{ transformPerspective: 600, transformOrigin: "left center" }}
      >
        <div className="absolute inset-4 rounded-full border-4 border-amber-900/30" />
        <motion.div
          className="absolute inset-12 grid place-items-center rounded-full border-4 border-amber-900/40 bg-amber-400/40"
          animate={reduce ? undefined : spinning ? { rotate: [0, 270, 90, 360] } : state === "ready" ? { rotate: [0, 12, -12, 0] } : { rotate: 0 }}
          transition={spinning ? { duration: 1.4, repeat: Infinity } : state === "ready" ? { duration: 1.8, repeat: Infinity } : undefined}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="absolute h-1.5 w-7 rounded-full bg-amber-900/40" style={{ transform: `rotate(${i * 45}deg)` }} />
          ))}
          <span className="relative size-6 rounded-full bg-amber-900/50" />
        </motion.div>
      </motion.div>
      {state === "open" && <div className="absolute inset-0 -z-10 grid place-items-center rounded-full bg-amber-50 text-6xl">✨</div>}
    </div>
  );
}

export function VaultCard({ vault }: { vault: VaultView }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<{ rewards: RewardResult[]; xp: number } | null>(null);
  const { run, pending } = useAction(unlockVaultAction, {
    refresh: false,
    onSuccess: (d) => {
      setTimeout(() => {
        setOpening(false);
        setReveal({ rewards: d.rewards, xp: d.xp });
      }, 1200);
    },
    onError: () => setOpening(false),
  });
  const state = vault.unlocked || reveal ? "open" : opening || pending ? "opening" : vault.ready ? "ready" : "locked";

  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
      <div className="bg-[linear-gradient(180deg,oklch(0.97_0.04_85),white)] px-4 pt-6 pb-4 text-center">
        <VaultDoor state={state} />
        <h2 className="mt-4 text-xl font-bold">
          {vault.icon} {vault.name}
        </h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{vault.description}</p>
        {!vault.unlocked && (
          <div className="mx-auto mt-3 flex max-w-xs items-center gap-2">
            <Progress value={vault.progress} className="h-2" indicatorClassName="bg-amber-500" aria-label="Vault requirements met" />
            <span className="text-xs font-bold text-muted-foreground">{vault.progress}%</span>
          </div>
        )}
      </div>
      <div className="space-y-4 p-4">
        {vault.unlocked ? (
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-success">Opened{vault.unlockedAt ? ` on ${formatDate(vault.unlockedAt)}` : ""}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {vault.unlockRewards.map((r, i) => (
                <RewardChip key={i} reward={r} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <h3 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Requirements</h3>
              <RequirementList requirements={vault.requirements} />
            </div>
            <Button
              size="xl"
              variant={vault.ready ? "gold" : "secondary"}
              className="w-full"
              disabled={!vault.ready || pending || opening}
              onClick={() => {
                setOpening(true);
                run(vault.id);
              }}
            >
              {(pending || opening) && <Loader2 className="animate-spin" />}
              {vault.ready ? (pending || opening ? "Opening the Vault..." : "Open the Vault") : "Keep collecting"}
            </Button>
          </>
        )}
        {vault.prizes.length > 0 && !vault.unlocked && (
          <div>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Inside the Vault</h3>
            <ul className="flex flex-wrap gap-1.5">
              {vault.prizes.map((p) => (
                <li key={p.id} className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium">
                  <span aria-hidden>{p.icon}</span>
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <RewardReveal
        open={Boolean(reveal)}
        onClose={() => {
          setReveal(null);
          router.refresh();
        }}
        title={`${vault.name} opened!`}
        rewards={reveal?.rewards ?? []}
        xp={reveal?.xp}
      />
    </div>
  );
}
