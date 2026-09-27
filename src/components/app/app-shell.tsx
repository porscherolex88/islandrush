import type { ReactNode } from "react";
import { BottomNavigation } from "./bottom-navigation";
import { MobileHeader } from "./mobile-header";

/**
 * Mobile-first user app frame. On phones it is full-bleed; on larger screens it is
 * presented as a centred phone-like canvas rather than a stretched dashboard.
 */
export function AppShell({ children, credits, withdrawable, unread, banner }: { children: ReactNode; credits: bigint; withdrawable: bigint; unread: number; banner?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface md:flex md:items-center md:justify-center md:bg-[radial-gradient(circle_at_20%_10%,oklch(0.9_0.05_205),transparent_45%),radial-gradient(circle_at_80%_90%,oklch(0.93_0.06_85),transparent_40%)] md:py-6">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background md:h-[min(920px,calc(100dvh-3rem))] md:min-h-0 md:overflow-hidden md:rounded-[2.25rem] md:border md:shadow-lift">
        <MobileHeader credits={credits} withdrawable={withdrawable} unread={unread} />
        {banner}
        <main id="main" className="flex-1 pb-6 md:overflow-y-auto md:overscroll-contain">
          {children}
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
}
