import type { CSSProperties, ReactNode } from "react";
import { BodyTheme } from "@/components/shared/body-theme";
import { BottomNavigation } from "./bottom-navigation";
import { PushDrawerFrame } from "./side-drawer";

const THEME = "theme-coinbase";

/**
 * Mobile-first user app frame. On phones it is full-bleed; on larger screens it is
 * presented as a centred phone-like canvas rather than a stretched dashboard. The
 * framed, inner-scrolling canvas is limited to pointer devices (`desktop:`); tablets
 * and phones always scroll the document so Safari's toolbar can collapse.
 * There is no global header: each bottom-nav destination renders its own header from
 * root-page-header, and every other page renders InnerPageHeader. The bottom nav only
 * appears on the five roots. `drawer` is the left push drawer opened by DrawerTrigger.
 */
export function AppShell({ children, banner, drawer }: { children: ReactNode; banner?: ReactNode; drawer: ReactNode }) {
  return (
    <div className={`${THEME} min-h-dvh bg-background text-foreground desktop:flex desktop:bg-surface desktop:items-center desktop:justify-center desktop:bg-[radial-gradient(circle_at_20%_10%,var(--brand-soft),transparent_45%),radial-gradient(circle_at_80%_90%,var(--gold-soft),transparent_40%)] desktop:py-6`}>
      <BodyTheme className={THEME} />
      <div
        data-sheet-host
        className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip bg-background desktop:h-[min(920px,calc(100dvh-3rem))] desktop:min-h-0 desktop:overflow-hidden desktop:rounded-[2.25rem] desktop:border desktop:[contain:layout]"
        style={{ "--drawer-w": "min(82vw, 320px)" } as CSSProperties}
      >
        <PushDrawerFrame drawer={drawer} nav={<BottomNavigation />}>
          <main id="main" className="flex-1 desktop:overflow-y-auto desktop:overscroll-contain">
            {banner && <div className="pt-[calc(env(safe-area-inset-top)+0.5rem)]">{banner}</div>}
            {children}
          </main>
        </PushDrawerFrame>
      </div>
    </div>
  );
}
