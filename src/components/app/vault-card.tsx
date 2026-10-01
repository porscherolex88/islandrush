"use client";

import { motion, useReducedMotion } from "motion/react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { unlockVaultAction } from "@/server/actions/games";
import type { RewardResult } from "@/server/services/rewards";
import { ART, ProgressRing, Token } from "./art";
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
  prizes: { id: string; label: string; icon: string; rarity: string }[];
};

function VaultDoor({ state }: { state: "locked" | "ready" | "opening" | "open" }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto aspect-square w-full max-w-72">
      {(state === "ready" || state === "opening" || state === "open") && (
        <div aria-hidden className="animate-glow absolute inset-6 rounded-full bg-amber-300/50 blur-2xl" />
      )}
      <motion.div
        className="relative size-full"
        animate={reduce ? undefined : state === "opening" ? { rotate: [0, -1.5, 1.5, -1.5, 1.5, 0], scale: [1, 1.02, 1.04] } : state === "ready" ? { scale: [1, 1.015, 1] } : undefined}
        transition={state === "opening" ? { duration: 0.6, repeat: Infinity } : state === "ready" ? { duration: 2.2, repeat: Infinity } : undefined}
      >
        <Image
          src={ART.vault}
          alt={state === "open" ? "The vault door, opened" : "The vault door, locked"}
          fill
          priority
          sizes="288px"
          className={cn("rounded-[2rem] object-cover", state === "locked" && "saturate-[.7]", state === "open" && "brightness-110")}
        />
        {state === "locked" && (
          <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Lock className="size-3.5" aria-hidden /> Locked
          </span>
        )}
        {state === "open" && (
          <span className="absolute inset-0 grid place-items-center rounded-[2rem] bg-[radial-gradient(circle,rgb(253_230_138/0.75),transparent_65%)]">
            <Sparkles className="size-14 text-white" aria-hidden />
          </span>
        )}
      </motion.div>
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
      }, 1400);
    },
    onError: () => setOpening(false),
  });
  const state = vault.unlocked || reveal ? "open" : opening || pending ? "opening" : vault.ready ? "ready" : "locked";
  const consumed = vault.requirements.filter((r) => r.consume);
  const kept = vault.requirements.filter((r) => !r.consume);

  return (
    <div className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_0%,oklch(0.4_0.07_215),oklch(0.22_0.045_228)_75%)] text-white">
      <div className="px-4 pt-5 text-center">
        <p className="text-xs font-bold text-amber-200">{vault.unlocked ? "Opened" : state === "ready" ? "Vault ready" : "Locked"}</p>
        <h2 className="mt-1 font-heading text-3xl font-extrabold">{vault.name}</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-white/75">{vault.description}</p>
      </div>
      <div className="px-6 pt-4">
        <VaultDoor state={state} />
      </div>

      <div className="space-y-4 p-4">
        {vault.unlocked ? (
          <div className="space-y-2 text-center">
            <p className="text-sm font-semibold text-emerald-300">Opened{vault.unlockedAt ? ` on ${formatDate(vault.unlockedAt)}` : ""}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {vault.unlockRewards.map((r, i) => (
                <RewardChip key={i} reward={r} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <ProgressRing value={vault.progress} size={76} stroke={7} className="text-white">
                <span className="font-heading text-lg font-extrabold tabular">{vault.progress}%</span>
              </ProgressRing>
              <div className="flex-1">
                <p className="font-heading text-lg font-bold">{state === "ready" ? "Everything is ready" : "What you need"}</p>
                <p className="text-sm text-white/70">
                  {vault.requirements.map((r) => `${Math.min(r.current, r.required)}/${r.required} ${r.label}`).join(" · ")}
                </p>
              </div>
            </div>
            <RequirementList requirements={vault.requirements} tone="dark" />
            {state === "ready" || state === "opening" ? (
              <ConfirmDialog
                trigger={
                  <Button size="pill" variant="gold" className="w-full" disabled={pending || opening}>
                    {pending || opening ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {pending || opening ? "Opening the vault..." : "Open the vault"}
                  </Button>
                }
                title={`Unlock ${vault.name}?`}
                confirmLabel="Unlock vault"
                onConfirm={async () => {
                  setOpening(true);
                  run(vault.id);
                }}
              >
                <div className="space-y-3 text-sm">
                  {consumed.length > 0 && (
                    <div>
                      <p className="font-semibold">This will use:</p>
                      <ul className="mt-2 space-y-1.5">
                        {consumed.map((r) => (
                          <li key={r.id} className="flex items-center gap-2">
                            <Token icon={r.icon} size="sm" rarity="RARE" />
                            <span>
                              <strong className="tabular">{r.required}</strong> {r.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 font-semibold text-destructive">These items will be used up.</p>
                    </div>
                  )}
                  {kept.length > 0 && <p className="text-muted-foreground">You keep: {kept.map((r) => r.label.replace(/^Collection: /, "")).join(", ")}.</p>}
                </div>
              </ConfirmDialog>
            ) : (
              <Button size="pill" variant="secondary" className="w-full bg-white/10 text-white/80 hover:bg-white/10" disabled>
                <Lock /> Vault locked
              </Button>
            )}
          </>
        )}
        {vault.prizes.length > 0 && !vault.unlocked && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-amber-200">Inside the vault</h3>
            <ul className="grid grid-cols-2 gap-2">
              {vault.prizes.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-white/5 p-2 text-xs font-semibold ring-1 ring-white/10">
                  <Token icon={p.icon} rarity={p.rarity} size="sm" />
                  <span className="line-clamp-2">{p.label}</span>
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
