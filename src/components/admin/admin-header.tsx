"use client";

import { ChevronRight, ExternalLink, LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavGroup } from "@/lib/admin/nav";
import { signOutAction } from "@/server/actions/auth";
import { AdminSidebar } from "./admin-sidebar";
import { ScrollFadeHeader } from "@/components/shared/scroll-fade-header";
import { humanize as humanizeEnum } from "@/components/shared/status-badge";

const LABELS: Record<string, string> = {
  admin: "Admin",
  finance: "Finance",
  economy: "Economy",
  games: "Games",
  manage: "Manage",
  daily: "Daily content",
  progression: "Progression",
  referrals: "Referrals",
  risk: "Risk",
  notifications: "Notifications",
  reports: "Reports",
  support: "Support",
  admins: "Admin management",
  audit: "Audit logs",
  system: "System",
  users: "Users",
  collections: "Collections",
  new: "New",
};

function humanize(seg: string) {
  if (LABELS[seg]) return LABELS[seg];
  if (/^[0-9a-f-]{20,}$/i.test(seg) || seg.length > 24) return "Details";
  return seg.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function Breadcrumbs() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  return (
    <ol className="hidden min-w-0 items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Breadcrumb">
      {segs.map((s, i) => {
        const href = `/${segs.slice(0, i + 1).join("/")}`;
        const last = i === segs.length - 1;
        return (
          <li key={href} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {last || s === "manage" ? (
              <span className={last ? "truncate font-medium text-foreground" : "truncate"}>{humanize(s)}</span>
            ) : (
              <Link href={href} className="truncate hover:text-foreground">
                {humanize(s)}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      className="relative w-full max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const q = ref.current?.value.trim();
        if (q) router.push(`/admin/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input ref={ref} name="q" placeholder="Search users, deposits, tickets..." aria-label="Global search" className="h-9 pr-12 pl-8" />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">⌘K</kbd>
    </form>
  );
}

export function AdminHeader({ nav, user }: { nav: NavGroup[]; user: { name: string; email: string; role: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <ScrollFadeHeader tint="var(--surface)" className="z-30 flex h-[66px] items-center gap-3 px-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Suspense>
            <AdminSidebar nav={nav} onNavigate={() => setOpen(false)} />
          </Suspense>
        </SheetContent>
      </Sheet>
      <Breadcrumbs />
      <div className="ml-auto flex flex-1 items-center justify-end gap-2">
        <GlobalSearch />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Account menu">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <p className="truncate">{user.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-[10px] font-semibold text-primary">{humanizeEnum(user.role)}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app">
                <ExternalLink /> Open player app
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="size-4" /> Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ScrollFadeHeader>
  );
}
