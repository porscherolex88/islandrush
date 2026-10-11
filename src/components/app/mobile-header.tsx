import { Coins } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatCredits } from "@/lib/money";
import { cn } from "@/lib/utils";
import { headerPillButton } from "./header-buttons";

/** Compact Credits balance for inner game headers, linking to the Wallet. */
export function CreditsChip({ credits }: { credits: bigint | number }) {
  return (
    <Link
      href="/wallet"
      className={cn(headerPillButton, "font-bold tabular")}
      aria-label={`${formatCredits(credits)} Credits, open Wallet`}
    >
      <Coins className="size-4 text-gold" aria-hidden />
      {formatCredits(credits)}
    </Link>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("px-4 py-2.5", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <h2 className="flex items-center gap-2 font-heading text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)} {...props}>
      {children}
    </div>
  );
}
