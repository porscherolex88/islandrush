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
    <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_85%_0%,oklch(0.52_0.1_200),oklch(0.3_0.07_222)_75%)] p-5 text-white">
      <div aria-hidden className="absolute -top-14 -right-12 size-44 rounded-full bg-amber-300/15" />
      <p className="relative font-heading text-2xl leading-tight font-extrabold">Invite friends, explore together</p>
      <p className="relative mt-1 text-sm text-white/80">Share your link. When friends join and deposit, you earn a reward.</p>
      <div className="relative mt-4 flex items-center gap-2 rounded-2xl bg-white/10 p-2 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm text-white/85">{link}</span>
        <CopyButton value={link} label="Copy link" className="h-11 bg-white/15 px-3 text-sm text-white hover:bg-white/25" />
      </div>
      <div className="relative mt-2 flex items-center justify-between gap-2 px-1">
        <p className="text-sm text-white/75">
          Your code: <span className="font-mono text-base font-bold tracking-[0.15em] text-white">{code}</span>
        </p>
        <CopyButton value={code} className="h-11 px-3 text-sm text-white hover:bg-white/15" />
      </div>
      <Button onClick={share} size="pill" variant="gold" className="relative mt-3 w-full">
        <Share2 /> Share invite
      </Button>
    </div>
  );
}
