import { and, gte, lte, sql } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DailyPlanPreview } from "@/components/admin/daily-plan-preview";
import { AdminCard, AdminPage, str } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { dailySchedules } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { rows } from "@/server/admin/queries";
import { getDailyPlan, today } from "@/server/services/daily";

export const metadata: Metadata = { title: "Daily content" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DailyPage({ searchParams }: PageProps<"/admin/daily">) {
  await requireAdmin("daily.manage");
  const sp = await searchParams;
  const todayKey = await today();
  const monthParam = str(sp.month);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayKey.slice(0, 7);
  const focus = str(sp.focus);
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const [schedules, todayPlan, activity] = await Promise.all([
    db.select().from(dailySchedules).where(and(gte(dailySchedules.day, first), lte(dailySchedules.day, last))),
    getDailyPlan(todayKey),
    rows<{ d: string; spins: number; events: number; logins: number }>(sql`
      select d::text,
        (select count(*)::int from daily_spins s where s.day = d) as spins,
        (select count(*)::int from daily_event_claims e where e.day = d) as events,
        (select count(*)::int from daily_logins l where l.day = d) as logins
      from generate_series(${first}::date, least(${last}::date, ${todayKey}::date), interval '1 day') d`),
  ]);
  const byDay = new Map(schedules.map((s) => [s.day, s]));
  const act = new Map(activity.map((a) => [a.d, a]));
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const daysInMonth = Number(last.slice(8));
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const monthLabel = new Date(`${first}T00:00:00Z`).toLocaleDateString("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });
  const q = focus ? `&focus=${focus}` : "";

  return (
    <AdminPage
      title="Daily content calendar"
      description="Schedule Daily Spin pools, missions, Mystery events and teasers per day. Days without a published schedule use the defaults."
      actions={
        <Button asChild variant="outline">
          <Link href="/admin/economy/settings/daily_defaults">Edit defaults</Link>
        </Button>
      }
    >
      <AdminCard
        title={monthLabel}
        actions={
          <div className="flex gap-1">
            <Button asChild size="icon" variant="outline" aria-label="Previous month">
              <Link href={`/admin/daily?month=${shiftMonth(month, -1)}${q}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/daily${focus ? `?focus=${focus}` : ""}`}>Today</Link>
            </Button>
            <Button asChild size="icon" variant="outline" aria-label="Next month">
              <Link href={`/admin/daily?month=${shiftMonth(month, 1)}${q}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[42rem] grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-1 text-xs font-medium text-muted-foreground">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const s = byDay.get(day);
              const a = act.get(day);
              const isToday = day === todayKey;
              return (
                <Link
                  key={day}
                  href={s ? `/admin/daily/${s.id}` : `/admin/manage/dailySchedules/new?day=${day}`}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 text-xs hover:ring-2 hover:ring-primary/40",
                    isToday && "border-primary",
                    s?.status === "PUBLISHED" && "bg-primary/5",
                    s?.status === "DRAFT" && "border-dashed bg-muted/40",
                    day < todayKey && "opacity-75",
                  )}
                >
                  <span className={cn("font-semibold", isToday && "text-primary")}>{Number(day.slice(8))}</span>
                  {s ? (
                    <>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.status}</span>
                      {(focus !== "spin" || !s.spinPoolId) && s.eventTitle && (
                        <span className="line-clamp-2">
                          {s.eventIcon} {s.eventTitle}
                          {s.eventCostCredits ? ` · ${formatCredits(s.eventCostCredits)} Cr` : ""}
                        </span>
                      )}
                      {focus === "spin" && s.spinPoolId && <span>🎡 Custom spin</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Defaults</span>
                  )}
                  {a && (
                    <span className="mt-auto text-[10px] text-muted-foreground tabular-nums">
                      {a.logins} in · {a.spins} spins{focus === "event" ? ` · ${a.events} events` : ""}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </AdminCard>
      <AdminCard title={`Today (${todayKey})`} description={todayPlan.scheduled ? "From a published schedule" : "From defaults"}>
        <DailyPlanPreview plan={todayPlan} />
      </AdminCard>
    </AdminPage>
  );
}
