"use client";

import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { parentRoute, routeLabel } from "@/lib/app-routes";
import { cn } from "@/lib/utils";

/**
 * The single header for every page below the five bottom-nav roots.
 * Back goes to the page's logical parent from the route map (or `back` when given),
 * never browser history, so it can't leave the app or loop.
 */
export function InnerPageHeader({
  title,
  subtitle,
  action,
  icon,
  art,
  back,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** Lucide icon shown in a small tinted tile beside the title. */
  icon?: ReactNode;
  /** Illustration thumbnail (from ART) shown instead of `icon`. */
  art?: string;
  back?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const href = back ?? parentRoute(pathname);
  const parentLabel = routeLabel(href);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-backdrop-filter:bg-background/85",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-1.5 px-2 py-1.5 md:min-h-16 md:px-3">
        <Link
          href={href}
          className="grid size-11 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Go back"
          title={parentLabel ? `Back to ${parentLabel}` : "Back"}
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        {art ? (
          <span className="relative size-9 shrink-0 overflow-hidden rounded-xl bg-ocean-deep shadow-card ring-1 ring-black/5" aria-hidden>
            <Image src={art} alt="" fill sizes="36px" className="object-cover" />
          </span>
        ) : icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary [&_svg]:size-[18px]" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 px-1">
          {parentLabel && <p className="hidden text-xs font-medium text-muted-foreground md:block">{parentLabel}</p>}
          <h1 className={cn("font-heading text-lg leading-tight font-bold break-words md:text-xl", subtitle ? "truncate" : "line-clamp-2")}>{title}</h1>
          {subtitle && <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-1 pr-1">{action}</div>}
      </div>
    </header>
  );
}
