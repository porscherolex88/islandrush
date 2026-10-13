import { Gift } from "lucide-react";
import Link from "next/link";
import { Marquee } from "./marquee";

export type PromoItem = { id: string; title: string; link: string | null };

/** Evergreen offers that are always true, used when no admin banner is live. */
const EVERGREEN: PromoItem[] = [
  { id: "spin", title: "Free daily spin for every player", link: "/register" },
  { id: "streak", title: "Streak milestones at 3, 7, 14 and 30 days", link: "/rewards" },
  { id: "refer", title: "Invite a friend, earn a reward on their first deposit", link: "/referrals" },
  { id: "odds", title: "Every Mystery Box shows its odds before you open it", link: "/games" },
];

export function PromoTicker({ banners }: { banners: PromoItem[] }) {
  const items = banners.length ? [...banners, ...EVERGREEN.slice(0, Math.max(0, 4 - banners.length))] : EVERGREEN;
  return (
    <div className="border-b border-gold/30 bg-[linear-gradient(90deg,var(--gold-hi),var(--gold-lo))] text-[var(--gold-ink)]">
      <Marquee label="Promotions" duration={Math.max(24, items.length * 9)}>
        {items.map((b) => {
          const body = (
            <>
              <Gift className="size-3.5 shrink-0" aria-hidden />
              <span>{b.title}</span>
            </>
          );
          return b.link ? (
            <Link key={b.id} href={b.link} className="flex h-9 items-center gap-2 px-6 text-[13px] font-semibold whitespace-nowrap hover:underline active:scale-100">
              {body}
            </Link>
          ) : (
            <span key={b.id} className="flex h-9 items-center gap-2 px-6 text-[13px] font-semibold whitespace-nowrap">
              {body}
            </span>
          );
        })}
      </Marquee>
    </div>
  );
}
