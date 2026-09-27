import { BarChart3, BookOpen, ChevronRight, Trophy, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { xpRules } from "@/db/schema";
import { Token } from "@/components/app/art";
import { Section } from "@/components/app/mobile-header";
import { ProgressHeader } from "@/components/app/root-page-header";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { getCollectionsOverview } from "@/server/queries/collections";
import { getProgress } from "@/server/queries/progress";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const [p, cols, rules] = await Promise.all([getProgress(user), getCollectionsOverview(user.id), db.select().from(xpRules)]);
  const earned = p.achievements.filter((a) => a.earnedAt).length;
  const label = (source: string) => rules.find((r) => r.source === source)?.label ?? source.toLowerCase().replaceAll("_", " ");
  const featured = [...p.achievements]
    .sort((a, b) => {
      if (Boolean(a.earnedAt) !== Boolean(b.earnedAt)) return a.earnedAt ? 1 : -1;
      return b.current / Math.max(1, b.threshold) - a.current / Math.max(1, a.threshold);
    })
    .slice(0, 4);
  const rest = p.achievements.filter((a) => !featured.includes(a));

  const AchievementCard = ({ a }: { a: (typeof p.achievements)[number] }) => {
    const pct = Math.round((Math.min(a.current, a.threshold) / Math.max(1, a.threshold)) * 100);
    return (
      <div className={cn("flex flex-col gap-2 rounded-2xl border p-3", a.earnedAt ? "border-gold/40 bg-gold-soft/70" : "bg-card shadow-card")}>
        <Token icon={a.badgeIcon} rarity={a.earnedAt ? "LEGENDARY" : "COMMON"} owned={Boolean(a.earnedAt) || a.current > 0} size="md" />
        <div>
          <p className="text-sm leading-tight font-bold">{a.name}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
        </div>
        {a.earnedAt ? (
          <p className="mt-auto text-xs font-bold text-gold-foreground">Earned</p>
        ) : (
          <div className="mt-auto">
            <Progress value={pct} className="h-1.5" indicatorClassName="bg-amber-500" aria-label={`${a.name} progress`} />
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground tabular">
              {Math.min(a.current, a.threshold)} / {a.threshold}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <ProgressHeader
        userId={user.id}
        level={p.xp.level}
        title={p.xp.current?.title ?? "Explorer"}
        xp={p.xp.total}
        pct={p.xp.pct}
        toNext={p.xp.toNext}
        nextTitle={p.xp.next?.title ?? null}
      />

      <Section
        title={
          <>
            <Trophy className="size-5 text-gold" aria-hidden /> Achievements
          </>
        }
        action={
          <span className="text-sm font-bold text-muted-foreground tabular">
            {earned} / {p.achievements.length}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {featured.map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
        {rest.length > 0 && (
          <details className="mt-2">
            <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold text-primary hover:bg-brand-soft">See all {p.achievements.length} achievements</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {rest.map((a) => (
                <AchievementCard key={a.id} a={a} />
              ))}
            </div>
          </details>
        )}
      </Section>

      <Section
        title={
          <>
            <BookOpen className="size-5 text-primary" aria-hidden /> Collections
          </>
        }
        action={
          <Link href="/app/collections" className="flex h-11 items-center text-sm font-semibold text-primary">
            Open book
          </Link>
        }
      >
        <div className="space-y-2">
          {cols.collections.map((c) => (
            <Link key={c.id} href={`/app/collections/${c.slug}`} className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 shadow-card hover:bg-surface">
              <Token icon={c.icon} rarity="LEGENDARY" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{c.name}</p>
                <Progress value={(c.owned / Math.max(1, c.total)) * 100} className="mt-1.5 h-2" indicatorClassName={c.completedAt ? "bg-success" : "bg-amber-500"} aria-label={`${c.name} progress`} />
              </div>
              <span className="text-sm font-bold tabular">
                {c.owned}/{c.total}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </Section>

      <Section
        title={
          <>
            <BarChart3 className="size-5 text-primary" aria-hidden /> Statistics
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-2">
          {p.stats.map((s) => (
            <div key={s.condition} className="rounded-2xl border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="font-heading text-2xl font-extrabold tabular">
                {s.value.toLocaleString("en-MY")}
                {s.condition === "STREAK_DAYS" ? " days" : ""}
              </dd>
            </div>
          ))}
        </dl>
        {p.recentXp.length > 0 && (
          <details className="mt-2 rounded-2xl border bg-card">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">Recent XP</summary>
            <ul className="divide-y border-t">
              {p.recentXp.map((x) => (
                <li key={x.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="capitalize">{label(x.source)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{relativeTime(x.createdAt)}</span>
                    <span className="font-semibold text-primary">+{x.amount}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section>
        <Link href="/app/wallet#deposit-level" className="flex min-h-16 items-center gap-3 rounded-2xl bg-surface p-3 hover:bg-muted">
          <span className="grid size-10 place-items-center rounded-xl bg-card text-primary">
            <Wallet className="size-5" aria-hidden />
          </span>
          <span className="flex-1 text-sm">
            <span className="block font-semibold">Deposit Level: {p.deposit.current?.name ?? "Starter"}</span>
            <span className="text-xs text-muted-foreground">Sets your daily withdrawal limit. See details in Wallet.</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </Section>
    </div>
  );
}
