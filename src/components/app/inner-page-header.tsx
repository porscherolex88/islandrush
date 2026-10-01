"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ScrollFadeHeader } from "@/components/shared/scroll-fade-header";
import { parentRoute, routeLabel } from "@/lib/app-routes";
import { cn } from "@/lib/utils";
import { headerIconButton } from "./header-buttons";

/**
 * The single header for every page below the five bottom-nav roots.
 * Back goes to the page's logical parent from the route map (or `back` when given),
 * never browser history, so it can't leave the app or loop.
 */
export function InnerPageHeader({
  title,
  subtitle,
  action,
  back,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const href = back ?? parentRoute(pathname);
  const parentLabel = routeLabel(href);
  return (
    <ScrollFadeHeader className={cn("z-30 pt-[env(safe-area-inset-top)]", className)}>
      <div className="flex h-[66px] items-center gap-3 px-4 md:px-5">
        <Link
          href={href}
          className={headerIconButton}
          aria-label={parentLabel ? `Go back to ${parentLabel}` : "Go back"}
        >
          <ArrowLeft className="size-[18px]" strokeWidth={2.25} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={cn("font-heading text-lg leading-tight font-extrabold tracking-tight truncate")}>{title}</h1>
          {subtitle && <p className="truncate text-xs font-medium text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
      </div>
    </ScrollFadeHeader>
  );
}
