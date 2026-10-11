import { CalendarCheck, LogOut, Settings } from "lucide-react";
import type { ComponentProps } from "react";
import Link from "next/link";
import type { StatusBadge } from "@/components/shared/status-badge";
import { signOutAction } from "@/server/actions/auth";
import { AccountMenu } from "./account-menu";
import { LegalLinks } from "./legal-sheet";
import { Section } from "./mobile-header";
import { UserAvatar } from "./root-page-header";
import { DrawerClose } from "./side-drawer";

/** Side drawer contents: the Account page profile card and full account menu. */
export function AppDrawer({
  name,
  email,
  joined,
  verificationStatus,
  isAdmin,
  unread,
}: {
  name: string;
  email: string;
  joined: Date;
  verificationStatus: ComponentProps<typeof StatusBadge>["status"];
  isAdmin: boolean;
  unread: number;
}) {
  return (
    <div className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]">
        <div className="flex h-[66px] items-center justify-between px-4 md:px-5">
          <DrawerClose />
          <Link
            href="/account"
            aria-label="Settings"
            className="grid size-10 shrink-0 place-items-center rounded-full border bg-card transition-colors outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="px-4 pb-2">
        <Link
          href="/account/profile"
          className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${name}, open profile`}
        >
          <div className="flex flex-col items-center px-4 text-center">
            <UserAvatar name={name} className="size-20 text-2xl" />
            <p className="mt-2 w-full truncate font-heading text-lg leading-tight font-extrabold" title={name}>
              {name}
            </p>
            <p className="w-full truncate text-xs text-muted-foreground" title={email}>
              {email}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-3 pb-4">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold whitespace-nowrap text-muted-foreground">
              <CalendarCheck className="size-3.5" aria-hidden /> Joined {joined.toLocaleDateString("en-MY", { month: "short", year: "numeric" })}
            </span>
          </div>
        </Link>
      </div>

      <nav aria-label="Menu">
        <AccountMenu verificationStatus={verificationStatus} unread={unread} isAdmin={isAdmin} />
      </nav>

      <Section className="mt-auto pt-6 pb-4">
        <form action={signOutAction}>
          <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border bg-card font-semibold text-destructive hover:bg-destructive/5">
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </form>
        <LegalLinks className="mt-4 text-center text-xs text-muted-foreground" />
      </Section>
    </div>
  );
}
