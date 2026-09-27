import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { xpRules } from "@/db/schema";
import { PageHeader, Section } from "@/components/app/mobile-header";
import { DepositLevelCard, XPProgress } from "@/components/app/progression";
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

  return (
    <div>
      <PageHeader title="Progress" subtitle="Your levels, badges and stats" />
      <Section>
        <XPProgress
          level={p.xp.level}
          title={p.xp.current?.title ?? "Explorer"}
          total={p.xp.total}
          pct={p.xp.pct}
          toNext={p.xp.toNext}
          nextTitle={p.xp.next?.title ?? null}
        />
      </Section>
      <Section>
        <DepositLevelCard current={p.deposit.current} next={p.deposit.next} levels={p.deposit.levels} total={p.deposit.total} pct={p.deposit.pct} toNext={p.deposit.toNext} />
      </Section>

      <Section title="Collections" action={<Link href="/app/collections" className="text-xs font-semibold text-primary">View all</Link>}>
        <div className="space-y-2">
          {cols.collections.map((c) => (
            <Link key={c.id} href={`/app/collections/${c.slug}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-surface">
              <span className="grid size-10 place-items-center rounded-xl bg-surface text-2xl" aria-hidden>
                {c.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <Progress value={(c.owned / Math.max(1, c.total)) * 100} className="mt-1.5 h-1.5" indicatorClassName={c.completedAt ? "bg-success" : undefined} aria-label={`${c.name} progress`} />
              </div>
              <span className="text-xs font-bold text-muted-foreground tabular">
                {c.owned}/{c.total}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </Section>

      <Section title={`Achievements · ${earned}/${p.achievements.length}`}>
        <div className="grid grid-cols-3 gap-2">
          {p.achievements.map((a) => (
            <div
              key={a.id}
              className={cn("flex flex-col items-center rounded-2xl border p-3 text-center", a.earnedAt ? "bg-gold-soft/60 border-gold/40" : "bg-card")}
              title={a.description}
            >
              <span className={cn("text-3xl", !a.earnedAt && "opacity-30 grayscale")} aria-hidden>
                {a.badgeIcon}
              </span>
              <p className="mt-1 line-clamp-1 text-xs font-bold">{a.name}</p>
              <p className="line-clamp-2 text-[10px] text-muted-foreground">{a.description}</p>
              {!a.earnedAt && (
                <p className="mt-1 text-[10px] font-semibold text-muted-foreground tabular">
                  {a.current}/{a.threshold}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Statistics">
        <dl className="grid grid-cols-2 gap-2">
          {p.stats.map((s) => (
            <div key={s.condition} className="rounded-2xl border bg-card p-3">
              <dt className="text-xs text-muted-foreground">
                <span aria-hidden>{s.icon}</span> {s.label}
              </dt>
              <dd className="font-heading text-xl font-bold tabular">
                {s.value.toLocaleString("en-MY")}
                {s.condition === "STREAK_DAYS" ? " days" : ""}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {p.recentXp.length > 0 && (
        <Section title="Recent XP">
          <ul className="divide-y rounded-2xl border bg-card">
            {p.recentXp.map((x) => (
              <li key={x.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="capitalize">{label(x.source)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{relativeTime(x.createdAt)}</span>
                  <span className="font-semibold text-primary">+{x.amount}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
