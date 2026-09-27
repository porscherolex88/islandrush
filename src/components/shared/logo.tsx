import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id="lb-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect x="3" y="12" width="26" height="17" rx="4" fill="url(#lb-lid)" />
      <path d="M5 8.5a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3V13H5z" fill="#a78bfa" />
      <rect x="14" y="5.5" width="4" height="23.5" fill="#fbbf24" />
      <circle cx="16" cy="17" r="3.2" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight", className)}>
      <LogoMark />
      <span>
        Loot<span className="text-primary">Box</span>
      </span>
    </Link>
  );
}
