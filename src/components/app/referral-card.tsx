"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";

/** Referral code and link with copy and native share. */
export function ReferralCard({ code, link }: { code: string; link: string }) {
  async function share() {
    const data = { title: "Join me on LootBox", text: `Explore Lost Island with me on LootBox. Use my code ${code} when you sign up.`, url: link };
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
    <div className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,oklch(0.5_0.2_285),oklch(0.42_0.2_300))] p-5 text-white shadow-lift">
      <p className="text-xs font-semibold tracking-wider text-white/70 uppercase">Your referral code</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="font-mono text-3xl font-bold tracking-[0.2em]">{code}</p>
        <CopyButton value={code} className="bg-white/15 text-white hover:bg-white/25" />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 p-2 pl-3">
        <span className="min-w-0 flex-1 truncate text-xs text-white/80">{link}</span>
        <CopyButton value={link} label="Copy link" className="bg-white/15 text-white hover:bg-white/25" />
      </div>
      <Button onClick={share} size="xl" variant="gold" className="mt-4 w-full">
        <Share2 /> Invite friends
      </Button>
    </div>
  );
}
