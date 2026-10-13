import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

/** Invite rewards total over a ripple of rings, one ring per circle of friends. */
export function ReferralHero({ total, stats }: { total: string; stats: { label: string; value: string }[] }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgb(255_255_255/0.16),transparent_55%)]" />
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -top-12 -right-16 size-64 text-white">
        {[96, 76, 56, 36].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth="1.25" />
        ))}
        <circle cx="100" cy="100" r="14" fill="currentColor" fillOpacity={0.3} />
      </svg>

      <div className="relative">
        <p className="text-sm text-white/75">Total invite rewards</p>
        <p className="mt-1 font-heading text-4xl font-extrabold tracking-tight tabular">{total}</p>
        <p className="mt-2 max-w-[30ch] text-sm text-white/75">Everything you have earned from invites, including rewards still under review.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="#friends"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-primary outline-none hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <Users className="size-4" aria-hidden /> Your friends
          </Link>
          <Link
            href="/wallet"
            className="inline-flex h-10 items-center gap-1 rounded-full bg-white/15 px-4 text-sm font-semibold outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Wallet <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15">
              <dt className="text-[11px] text-white/75">{s.label}</dt>
              <dd className="mt-0.5 truncate font-heading text-base font-bold tabular">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
