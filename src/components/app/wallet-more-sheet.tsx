"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { focusRing } from "./kit";

/** Fourth wallet action: opens a sheet with secondary wallet tools. `/wallet#<openOnHash>` opens it directly. */
export function WalletMoreSheet({ openOnHash, children }: { openOnHash: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (window.location.hash !== `#${openOnHash}`) return;
      setOpen(true);
      requestAnimationFrame(() => {
        const el = document.getElementById(openOnHash);
        if (el instanceof HTMLDetailsElement) el.open = true;
        el?.scrollIntoView({ block: "start" });
      });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [openOnHash]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className={cn("group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-xs font-bold", focusRing)}>
          <span className="grid size-14 place-items-center rounded-full border bg-card text-primary transition-colors group-hover:bg-surface">
            <MoreHorizontal className="size-6" aria-hidden />
          </span>
          More
        </button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">More</SheetTitle>
          <SheetDescription>Your Deposit Level, bank accounts, limits and help.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
