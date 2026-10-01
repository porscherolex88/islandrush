"use client";

import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  Coins,
  FileText,
  Gamepad2,
  Gem,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Map as MapIcon,
  ScrollText,
  Settings,
  Share2,
  ShieldAlert,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/shared/logo";
import type { NavGroup } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Landmark,
  Coins,
  Gamepad2,
  Map: MapIcon,
  Gem,
  CalendarDays,
  TrendingUp,
  Share2,
  ShieldAlert,
  Bell,
  BarChart3,
  LifeBuoy,
  FileText,
  UserCog,
  ScrollText,
  Settings,
};

function useIsActive() {
  const pathname = usePathname();
  const sp = useSearchParams();
  return (href: string, exact = false) => {
    const [path, query] = href.split("?");
    const cleanPath = path.split("#")[0];
    if (query) {
      const q = new URLSearchParams(query);
      if (pathname !== cleanPath) return false;
      return [...q].every(([k, v]) => sp.get(k) === v);
    }
    return exact || cleanPath === "/admin" ? pathname === cleanPath : pathname === cleanPath || pathname.startsWith(`${cleanPath}/`);
  };
}

export function AdminSidebar({ nav, onNavigate }: { nav: NavGroup[]; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(nav.filter((g) => g.children?.some((c) => isActive(c.href))).map((g) => [g.label, true])),
  );
  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <Link href="/admin" className="flex h-[66px] shrink-0 items-center gap-2 border-b px-4 font-heading font-bold" onClick={onNavigate}>
        <LogoMark className="size-7" />
        LootBox <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Admin</span>
      </Link>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2 text-sm">
        {nav.map((g) => {
          const Icon = ICONS[g.icon] ?? LayoutDashboard;
          if (!g.children) {
            return (
              <Link
                key={g.label}
                href={g.href!}
                onClick={onNavigate}
                className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground", isActive(g.href!) && "bg-primary/10 text-primary")}
              >
                <Icon className="size-4" aria-hidden />
                {g.label}
              </Link>
            );
          }
          const expanded = open[g.label] ?? false;
          const groupActive = g.children.some((c) => isActive(c.href));
          return (
            <div key={g.label}>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.label]: !expanded }))}
                aria-expanded={expanded}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground", groupActive && "text-foreground")}
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
              </button>
              {expanded && (
                <div className="mt-0.5 mb-1 ml-[1.35rem] space-y-0.5 border-l pl-2">
                  {g.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={onNavigate}
                      className={cn("block rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground", isActive(c.href) && "bg-primary/10 font-medium text-primary")}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
