"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const PUBLIC_NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/games", label: "Games" },
  { href: "/rewards", label: "Rewards" },
  { href: "/referrals", label: "Referrals" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {PUBLIC_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === n.href && "text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="grid gap-1 px-4" aria-label="Mobile">
              {[...PUBLIC_NAV, { href: "/help", label: "Help centre" }, { href: "/contact", label: "Contact" }].map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-medium hover:bg-muted">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 p-4">
              <Button asChild size="xl">
                <Link href="/register" onClick={() => setOpen(false)}>
                  Get started
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
