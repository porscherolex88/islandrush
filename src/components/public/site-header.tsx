"use client";

import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { ScrollFadeHeader } from "@/components/shared/scroll-fade-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";

export const PUBLIC_NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/games", label: "Games" },
  { href: "/rewards", label: "Rewards" },
  { href: "/referrals", label: "Referrals" },
  { href: "/faq", label: "FAQ" },
];

function AuthActions({ signedIn, onNavigate }: { signedIn: boolean; onNavigate?: () => void }) {
  if (!signedIn) {
    return (
      <>
        <Button asChild variant="ghost" size="xl" className="md:h-10 md:px-4 md:text-sm">
          <Link href="/login" onClick={onNavigate}>
            Sign in
          </Link>
        </Button>
        <Button asChild size="xl" className="md:h-10 md:px-4 md:text-sm">
          <Link href="/register" onClick={onNavigate}>
            Get started
          </Link>
        </Button>
      </>
    );
  }

  const launch = (
    <Button asChild size="xl" className={cn("md:h-10 md:px-4 md:text-sm", onNavigate && "flex-1")}>
      <Link href="/home" onClick={onNavigate}>
        Launch App
      </Link>
    </Button>
  );
  const logout = (
    <form action={signOutAction} className={onNavigate ? undefined : "contents"}>
      <Button type="submit" variant="ghost" size="icon" className={cn("size-10 shrink-0", onNavigate && "size-14 border bg-card")} aria-label="Log out">
        <LogOut className="size-4" aria-hidden />
      </Button>
    </form>
  );

  if (onNavigate) {
    return (
      <div className="flex items-center gap-2">
        {launch}
        {logout}
      </div>
    );
  }

  return (
    <>
      {launch}
      {logout}
    </>
  );
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <ScrollFadeHeader className="z-40">
      <div className="mx-auto flex h-[66px] max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {PUBLIC_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === n.href && "bg-brand-soft font-semibold text-primary hover:bg-brand-soft hover:text-primary",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Button asChild size="sm" className="ml-auto h-10 rounded-full px-4 md:hidden">
          <Link href={signedIn ? "/home" : "/register"}>{signedIn ? "Launch App" : "Get started"}</Link>
        </Button>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <AuthActions signedIn={signedIn} />
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-4 size-11 md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-1 px-4" aria-label="Mobile">
              {[...PUBLIC_NAV, { href: "/help", label: "Help centre" }, { href: "/contact", label: "Contact" }].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === n.href ? "page" : undefined}
                  className={cn("rounded-xl px-3 py-3 font-medium hover:bg-muted", pathname === n.href && "bg-brand-soft text-primary hover:bg-brand-soft")}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 p-4">
              <AuthActions signedIn={signedIn} onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </ScrollFadeHeader>
  );
}
