"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Prose } from "@/components/public/marketing";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDate } from "@/lib/time";
import { legalPageAction, type LegalSlug } from "@/server/actions/content";

type LegalPage = Awaited<ReturnType<typeof legalPageAction>>;

const LINKS: { slug: LegalSlug; label: string }[] = [
  { slug: "terms", label: "Terms" },
  { slug: "privacy", label: "Privacy" },
  { slug: "responsible-play", label: "Responsible play" },
];

/** A legal link that opens the page in a bottom sheet, loading it the first time it opens. */
function LegalSheetLink({ slug, label }: { slug: LegalSlug; label: string }) {
  const [page, setPage] = useState<LegalPage | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const load = (open: boolean) => {
    if (!open || page !== undefined) return;
    startTransition(async () => {
      try {
        setPage(await legalPageAction(slug));
      } catch {
        setPage(null);
      }
    });
  };

  return (
    <Sheet onOpenChange={load}>
      <SheetTrigger asChild>
        <button type="button" className="underline underline-offset-2 hover:text-foreground">
          {label}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-[430px] overflow-y-auto rounded-t-3xl pb-safe">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">{page?.title ?? label}</SheetTitle>
          <SheetDescription>{page ? `Last updated ${formatDate(page.updatedAt)}` : page === null ? "This page isn't available right now." : "Loading..."}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {page ? (
            <Prose text={page.body} />
          ) : page === undefined || pending ? (
            <div className="space-y-2.5" aria-hidden>
              {[92, 100, 84, 96, 70].map((w, i) => (
                <div key={i} className="h-3.5 animate-pulse rounded-full bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <Link href={`/${slug}`} className={buttonVariants({ variant: "outline", size: "pill" })}>
              Open the full page
            </Link>
          )}
          {slug === "responsible-play" && page && (
            <Link href="/app/account/responsible-play" className={buttonVariants({ variant: "gold", size: "pill", className: "mt-6 w-full" })}>
              Open responsible play settings
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={className}>
      {LINKS.map((l, i) => (
        <span key={l.slug}>
          {i > 0 && " · "}
          <LegalSheetLink slug={l.slug} label={l.label} />
        </span>
      ))}
    </p>
  );
}
