"use client";

import { CalendarCheck, Compass, Home, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", label: "Home", icon: Home, match: ["/app", "/app/wallet", "/app/notifications"] },
  { href: "/app/play", label: "Play", icon: Compass, match: ["/app/play", "/app/collections"] },
  { href: "/app/daily", label: "Daily", icon: CalendarCheck, match: ["/app/daily"] },
  { href: "/app/progress", label: "Progress", icon: TrendingUp, match: ["/app/progress"] },
  { href: "/app/account", label: "Account", icon: UserRound, match: ["/app/account", "/app/referrals"] },
];

function isActive(pathname: string, match: string[]) {
  return match.some((m) => (m === "/app" ? pathname === "/app" : pathname === m || pathname.startsWith(`${m}/`)));
}

export function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-30 border-t bg-background/95 pb-safe backdrop-blur supports-backdrop-filter:bg-background/80">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(pathname, match);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-brand-soft")}>
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
