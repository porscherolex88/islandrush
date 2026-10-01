"use client";

import { CalendarCheck, Home, Store, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isRootRoute, rootSection, type RootRoute } from "@/lib/app-routes";
import { cn } from "@/lib/utils";

const TABS: { href: RootRoute; label: string; icon: typeof Home }[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/market", label: "Market", icon: Store },
  { href: "/app/daily", label: "Daily", icon: CalendarCheck },
  { href: "/app/progress", label: "Progress", icon: TrendingUp },
  { href: "/app/wallet", label: "Wallet", icon: Wallet },
];

export function BottomNavigation() {
  const pathname = usePathname();
  if (!isRootRoute(pathname)) return null;
  const section = rootSection(pathname);
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-30 border-t bg-background/95 pb-safe backdrop-blur supports-backdrop-filter:bg-background/80">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = section === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? (pathname === href ? "page" : "true") : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
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
