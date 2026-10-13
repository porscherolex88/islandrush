"use client";

import { AnimatePresence, motion } from "motion/react";
import { Banknote, CheckCircle2, Clock, Coins, Gift, Loader2, Lock, Puzzle, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { newKey, useAction } from "@/hooks/use-action";
import { puzzleColumns } from "@/lib/adventure";
import { cn } from "@/lib/utils";
import { claimPrizeAction, spinPrizeWheelAction } from "@/server/actions/games";
import type { PrizeView, PuzzleView, WheelResult } from "@/server/services/adventure";
import { PrizeWheel } from "./prize-wheel";

const CLAIM_LABEL: Record<string, { label: string; tone: string; text: string }> = {
  UNLOCKED: { label: "Ready to claim", tone: "bg-gold-soft text-gold-foreground", text: "Your prize is unlocked. Claim it to start delivery." },
  CLAIM_PENDING: { label: "Claim received", tone: "bg-brand-soft text-primary", text: "We have your details. Our team will review your claim." },
  UNDER_REVIEW: { label: "Under review", tone: "bg-brand-soft text-primary", text: "Our team is checking your claim." },
  APPROVED: { label: "Approved", tone: "bg-success-soft text-success", text: "Your claim is approved and being prepared." },
  FULFILLING: { label: "On its way", tone: "bg-success-soft text-success", text: "Your prize is being delivered." },
  FULFILLED: { label: "Delivered", tone: "bg-success-soft text-success", text: "Your prize has been delivered." },
  REJECTED: { label: "Not approved", tone: "bg-destructive/10 text-destructive", text: "This claim was not approved. Contact Support if you have questions." },
};

/** The prize cut into a grid. Each piece found shows its part of the prize picture. */
function PieceGrid({ have, required, image }: { have: number; required: number; image: string | null }) {
  const cols = puzzleColumns(required);
  const rows = Math.ceil(required / cols);
  return (
    <div
      className="mx-auto grid w-full max-w-60 gap-0.5 overflow-hidden rounded-2xl bg-border p-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${have} of ${required} Puzzle Pieces`}
    >
      {Array.from({ length: required }, (_, i) => {
        const found = i < have;
        const x = cols > 1 ? ((i % cols) / (cols - 1)) * 100 : 0;
        const y = rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 100 : 0;
        return (
          <span
            key={i}
            className={cn("grid aspect-square place-items-center rounded-[5px] bg-cover", found ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground/30")}
            style={found && image ? { backgroundImage: `url("${image}")`, backgroundSize: `${cols * 100}% ${rows * 100}%`, backgroundPosition: `${x}% ${y}%` } : undefined}
          >
            {!(found && image) && <Puzzle className="size-1/2 max-h-6 max-w-6" aria-hidden />}
          </span>
        );
      })}
    </div>
  );
}

const PRIZE_LOOK = {
  CREDITS: { icon: Coins, tone: "bg-[linear-gradient(135deg,var(--color-amber-50),var(--color-amber-200))] text-amber-700" },
  CASH: { icon: Banknote, tone: "bg-[linear-gradient(135deg,var(--color-emerald-50),var(--color-emerald-200))] text-emerald-700" },
  PHYSICAL: { icon: Gift, tone: "bg-[linear-gradient(135deg,var(--color-violet-50),var(--color-violet-200))] text-violet-700" },
} as const;

function PrizeImage({ src, kind, className }: { src: string | null; kind: PrizeView["kind"]; className?: string }) {
  if (src) return <Image src={src} alt="" width={96} height={96} unoptimized={/^https?:/.test(src)} className={cn("rounded-2xl object-cover", className)} />;
  const look = PRIZE_LOOK[kind];
  return (
    <span className={cn("grid place-items-center rounded-2xl", look.tone, className)} aria-hidden>
      {createElement(look.icon, { className: "size-1/2" })}
    </span>
  );
}

/** A later level's prize, kept compact so the current puzzle stays the focus. */
export function UpcomingPrize({ puzzle }: { puzzle: PuzzleView }) {
  const p = puzzle;
  return (
    <li className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-2.5">
      <PrizeImage src={p.prize.image} kind={p.prize.kind} className="size-11 shrink-0 [&_svg]:size-5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-primary">Adventure Level {p.level}</p>
        <p className="truncate text-sm font-semibold">{p.prize.name}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground tabular">
        <Puzzle className="size-3.5" aria-hidden />
        {p.piecesHave}/{p.piecesRequired}
      </span>
    </li>
  );
}

export function PuzzleCard({ puzzle, verified, enabled }: { puzzle: PuzzleView; verified: boolean; enabled: boolean }) {
  const router = useRouter();
  const [wheelOpen, setWheelOpen] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [settled, setSettled] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const key = useRef<string | null>(null);
  const p = puzzle;
  const missing = Math.max(0, p.piecesRequired - p.piecesHave);
  const needsVerification = p.prize.requiresVerification && !verified;

  const spin = useAction(spinPrizeWheelAction, {
    refresh: false,
    onSuccess: (d) => {
      key.current = null;
      setResult(d);
    },
  });

  function closeWheel() {
    setWheelOpen(false);
    setResult(null);
    setSettled(false);
    router.refresh();
  }

  const claimId = result?.claimId ?? (p.claim?.status === "UNLOCKED" ? p.claim.id : null);

  return (
    <article className={cn("overflow-hidden rounded-3xl border bg-card", p.complete && !p.attempt && "ring-2 ring-amber-300")}>
      <div className="flex gap-3 p-4">
        <PrizeImage src={p.prize.image} kind={p.prize.kind} className="size-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary">Adventure Level {p.level} prize</p>
          <h3 className="font-heading text-lg leading-tight font-extrabold">{p.prize.name}</h3>
          {p.prize.kind !== "PHYSICAL" && p.prize.display !== p.prize.name && <p className="text-sm font-semibold">{p.prize.display}</p>}
          {p.prize.estimatedValue && <p className="text-xs text-muted-foreground">Estimated value {p.prize.estimatedValue}</p>}
          {!p.prize.available && !p.attempt && <p className="mt-1 text-xs font-semibold text-warning">Currently unavailable. Your progress is kept.</p>}
        </div>
      </div>

      <div className="space-y-3 border-t bg-surface/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{p.name}</p>
          <p className="text-xs font-bold text-muted-foreground tabular">
            {p.piecesHave}/{p.piecesRequired} pieces
          </p>
        </div>
        <PieceGrid have={p.piecesHave} required={p.piecesRequired} image={p.prize.image} />

        {p.attempt ? (
          p.attempt.outcome === "PRIZE" ? (
            <div className="space-y-2">
              {p.claim && (
                <div className={cn("flex items-start gap-2 rounded-2xl p-3 text-sm", CLAIM_LABEL[p.claim.status]?.tone)}>
                  {p.claim.status === "FULFILLED" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  <span>
                    <strong className="block">{CLAIM_LABEL[p.claim.status]?.label}</strong>
                    {CLAIM_LABEL[p.claim.status]?.text}
                  </span>
                </div>
              )}
              {p.claim?.status === "UNLOCKED" && (
                <Button size="pill" variant="gold" className="h-12 w-full text-base" onClick={() => setClaimOpen(true)}>
                  Claim {p.prize.name}
                </Button>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-brand-soft p-3 text-sm text-primary">
              <strong className="block">Alternative reward received</strong>
              {p.attempt.alternativeDisplay}
            </p>
          )
        ) : p.complete ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Puzzle complete
            </p>
            {needsVerification ? (
              <div className="space-y-2 rounded-2xl bg-gold-soft p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="size-4" aria-hidden /> Verify your account to continue
                </p>
                <p className="text-muted-foreground">This prize needs a verified account before the final unlock.</p>
                <Link href="/account/verification" className={cn(buttonVariants({ variant: "outline", size: "pill" }), "w-full")}>
                  Verify account
                </Link>
              </div>
            ) : p.canSpin && enabled ? (
              <Button size="pill" variant="gold" className="h-12 w-full text-base" onClick={() => setWheelOpen(true)}>
                Final Prize Unlock
              </Button>
            ) : (
              <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">The final unlock is temporarily unavailable. Your puzzle stays complete, so you can try later.</p>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" aria-hidden />
            {missing > 0
              ? `Find ${missing} more ${missing === 1 ? "piece" : "pieces"} in the Big Mystery Box at the end of Map ${p.level}. Each one holds 1 to 3, and you can replay the map for more.`
              : `Finish the Adventure Level ${p.level} map to complete this puzzle.`}
          </p>
        )}
      </div>

      <AnimatePresence>
        {wheelOpen && (
          <motion.div role="dialog" aria-modal="true" aria-labelledby={`wheel-${p.id}`} className="fixed inset-0 z-50 grid place-items-center bg-ocean-deep/75 p-5 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-2xl" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              {(!result || settled) && (
                <button onClick={closeWheel} className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Close">
                  <X className="size-5" />
                </button>
              )}
              <p className="text-xs font-bold text-primary">Adventure Level {p.level} · Final Prize Unlock</p>
              <h2 id={`wheel-${p.id}`} className="font-heading text-xl font-extrabold">
                {p.prize.name}
              </h2>
              <div className="my-4">
                <PrizeWheel outcome={result?.outcome ?? null} onDone={() => setSettled(true)} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-left text-sm">
                <div className="rounded-xl bg-gold-soft p-2.5">
                  <dt className="text-xs font-semibold text-gold-foreground">Prize</dt>
                  <dd className="text-sm font-bold">{p.prize.name}</dd>
                </div>
                <div className="rounded-xl bg-brand-soft p-2.5">
                  <dt className="text-xs font-semibold text-primary">Bonus reward</dt>
                  <dd className="text-sm font-bold">{p.alternative.display}</dd>
                </div>
              </dl>
              <div aria-live="polite" className="mt-4 min-h-6">
                {result && settled && (
                  <p className="font-heading text-lg font-extrabold">{result.outcome === "PRIZE" ? `Unlocked: ${result.prizeName}` : `You received ${result.alternativeDisplay}`}</p>
                )}
                {result && settled && result.outcome === "ALTERNATIVE" && p.alternative.type === "CASH" && (
                  <p className="text-xs text-muted-foreground">Cash rewards are under review before becoming available to withdraw.</p>
                )}
              </div>
              <div className="mt-4 grid gap-2">
                {!result ? (
                  <>
                    <Button size="pill" variant="gold" className="h-12 text-base" disabled={spin.pending} onClick={() => spin.run({ puzzleId: p.id, idempotencyKey: (key.current ??= newKey()) })}>
                      {spin.pending && <Loader2 className="animate-spin" aria-hidden />}
                      Unlock
                    </Button>
                    <p className="text-xs text-muted-foreground">One attempt per puzzle. The result is decided securely on our servers.</p>
                  </>
                ) : settled && claimId && result.outcome === "PRIZE" ? (
                  <Button
                    size="pill"
                    variant="gold"
                    className="h-12 text-base"
                    onClick={() => {
                      setWheelOpen(false);
                      setClaimOpen(true);
                    }}
                  >
                    Claim prize
                  </Button>
                ) : settled ? (
                  <Button size="pill" variant="gold" className="h-12 text-base" onClick={closeWheel}>
                    Done
                  </Button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {claimId && <ClaimSheet open={claimOpen} onOpenChange={setClaimOpen} claimId={claimId} puzzle={p} />}
    </article>
  );
}

function ClaimSheet({ open, onOpenChange, claimId, puzzle }: { open: boolean; onOpenChange: (o: boolean) => void; claimId: string; puzzle: PuzzleView }) {
  const physical = puzzle.prize.kind === "PHYSICAL";
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", note: "" });
  const claim = useAction(claimPrizeAction, {
    success: (d) => (d.status === "FULFILLED" ? "Prize added to your balance" : "Claim submitted"),
    onSuccess: () => onOpenChange(false),
  });
  const ready = !physical || (form.fullName.trim() && form.phone.trim() && form.address.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">Claim {puzzle.prize.name}</SheetTitle>
          <SheetDescription>
            {physical
              ? "Tell us where to deliver your prize. Our team reviews every physical prize claim before delivery."
              : puzzle.prize.kind === "CASH"
                ? "The cash is added to your Pending Rewards. Cash rewards are under review before becoming available to withdraw."
                : "The Credits are added to your balance straight away."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="space-y-3 px-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) claim.run({ claimId, contact: physical ? form : {} });
          }}
        >
          {physical && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="claim-name">Full name</Label>
                <Input id="claim-name" autoComplete="name" className="h-11" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={120} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="claim-phone">Phone number</Label>
                <Input id="claim-phone" type="tel" autoComplete="tel" className="h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={40} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="claim-address">Delivery address</Label>
                <Textarea id="claim-address" autoComplete="street-address" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required maxLength={500} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="claim-note">Note (optional)</Label>
                <Input id="claim-note" className="h-11" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} />
              </div>
              {puzzle.prize.claimInstructions && <p className="rounded-2xl bg-surface p-3 text-xs text-muted-foreground">{puzzle.prize.claimInstructions}</p>}
            </>
          )}
          <SheetFooter className="px-0">
            <Button type="submit" size="pill" variant="gold" className="h-12 text-base" disabled={!ready || claim.pending}>
              {claim.pending && <Loader2 className="animate-spin" aria-hidden />}
              {physical ? "Submit claim" : "Claim now"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
