import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Seamless horizontal loop. Content is rendered twice and shifted by half its width,
 * so the duration controls speed regardless of item count. Pauses on hover and focus.
 */
export function Marquee({ children, className, duration = 40, label }: { children: ReactNode; className?: string; duration?: number; label: string }) {
  return (
    <div className={cn("group relative overflow-hidden mask-x-from-90% mask-x-to-100%", className)} role="region" aria-label={label}>
      <div className="flex w-max animate-marquee gap-0 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]" style={{ animationDuration: `${duration}s` }}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden inert>
          {children}
        </div>
      </div>
    </div>
  );
}
