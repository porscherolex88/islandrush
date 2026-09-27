import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const COLUMNS = [
  {
    title: "Play",
    links: [
      { href: "/games", label: "Games" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/rewards", label: "Rewards" },
      { href: "/referrals", label: "Referrals" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/help", label: "Help centre" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/responsible-play", label: "Responsible play" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Open boxes, explore Lost Island and unlock the Ancient Vault. New things to discover every day.</p>
          <p className="text-xs text-muted-foreground">18+ only. Play responsibly.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-semibold">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">© {new Date().getFullYear()} LootBox. All rights reserved.</p>
      </div>
    </footer>
  );
}
