"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";

/** Invite code with copy and native share, plus the numbered steps to earn. */
export function ReferralCard({ code, link, headline, steps }: { code: string; link: string; headline: string; steps: string[] }) {
  async function share() {
    const data = { title: "Join me on LootBox", text: `Join my adventure on LootBox. Use my code ${code} when you sign up.`, url: link };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    }
  }
  return (
    <div className="rounded-3xl border bg-card p-4">
      <p className="text-sm font-semibold text-primary">Invite friends</p>
      <h2 className="mt-0.5 font-heading text-xl leading-tight font-extrabold text-balance">{headline}</h2>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-3 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Your invite code</p>
          <p className="truncate font-mono text-lg font-bold tracking-[0.15em]">{code}</p>
        </div>
        <CopyButton value={link} label="Copy link" className="h-10 rounded-full border bg-card px-3.5 text-sm text-foreground hover:bg-background" />
      </div>

      <Button onClick={share} size="pill" className="mt-3 w-full">
        <Share2 /> Invite friends
      </Button>

      <ol className="mt-4 space-y-2.5 text-sm text-muted-foreground">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-primary tabular">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
