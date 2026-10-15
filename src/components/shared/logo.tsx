import Link from "next/link";
import { cn } from "@/lib/utils";

/** Flat 2D loot-crate mark. Uses currentColor-safe solid fills in brand teal/gold. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8", className)}>
      <rect width="64" height="64" rx="14" fill="#0B4F5C" />
      <rect x="10" y="28" width="44" height="26" rx="4" fill="#1B8A99" />
      <path d="M8 22c0-2.2 1.8-4 4-4h40c2.2 0 4 1.8 4 4v8H8v-8z" fill="#2FB3C1" />
      <rect x="8" y="28" width="48" height="4" fill="#0E6B78" />
      <rect x="28" y="14" width="8" height="40" rx="1" fill="#F5B942" />
      <rect x="24" y="34" width="16" height="12" rx="2" fill="#FBBF24" />
      <rect x="28" y="38" width="8" height="4" rx="1" fill="#0B4F5C" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight", className)}>
      <LogoMark />
      <span>
        Loot<span className="text-primary">Box</span>
      </span>
    </Link>
  );
}
