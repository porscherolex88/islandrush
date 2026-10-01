import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Grouped card of MenuRows, as used on the Account page and in the side drawer. */
export function MenuCard({ children }: { children: ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>;
}

export function MenuRow({ href, icon: Icon, label, meta }: { href: string; icon: LucideIcon; label: string; meta?: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 outline-none hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {meta}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
