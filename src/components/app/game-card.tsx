import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const GAME_THEMES = {
  box: { bg: "bg-[linear-gradient(135deg,oklch(0.95_0.05_295),oklch(0.98_0.02_300))]", icon: "🎁", accent: "text-violet-700" },
  map: { bg: "bg-[linear-gradient(135deg,oklch(0.95_0.05_170),oklch(0.98_0.02_190))]", icon: "🗺️", accent: "text-emerald-700" },
  vault: { bg: "bg-[linear-gradient(135deg,oklch(0.95_0.05_80),oklch(0.985_0.02_90))]", icon: "🏛️", accent: "text-amber-700" },
} as const;

export function GameCard({
  href,
  theme,
  title,
  description,
  meta,
  size = "default",
}: {
  href: string;
  theme: keyof typeof GAME_THEMES;
  title: string;
  description: string;
  meta?: string;
  size?: "default" | "compact";
}) {
  const t = GAME_THEMES[theme];
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-card",
        t.bg,
      )}
    >
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl bg-white shadow-card transition-transform group-hover:scale-105 group-hover:-rotate-3",
          size === "compact" ? "size-12 text-3xl" : "size-16 text-4xl",
        )}
        aria-hidden
      >
        {t.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {meta && <p className={cn("mt-1 text-xs font-semibold", t.accent)}>{meta}</p>}
      </div>
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
