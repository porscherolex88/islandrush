import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyPlanPreview } from "@/components/admin/daily-plan-preview";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, StatGrid, StatsCard } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { dailySchedules } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { one } from "@/server/admin/queries";
import { getDailyPlan } from "@/server/services/daily";

export const metadata: Metadata = { title: "Daily schedule" };

export default async function DailySchedulePage({ params }: PageProps<"/admin/daily/[id]">) {
  await requireAdmin("daily.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s] = await db.select().from(dailySchedules).where(eq(dailySchedules.id, id)).limit(1);
  if (!s) notFound();
  const [plan, stats] = await Promise.all([
    getDailyPlan(s.day, db, { includeDrafts: true }),
    one<{ logins: number; spins: number; bonus: number }>(sql`
      select (select count(*)::int from daily_logins where day = ${s.day}) as logins,
        (select count(*)::int from daily_spins where day = ${s.day}) as spins,
        (select count(*)::int from mission_bonus_claims where day = ${s.day}) as bonus`),
  ]);
  const back = `/admin/daily/${id}`;
  const date = new Date(`${s.day}T00:00:00+08:00`).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <AdminPage
      title={date}
      description={s.status === "PUBLISHED" ? "Live for players on this day." : "Draft: players see the defaults until this schedule is published."}
      actions={
        <>
          <StatusBadge status={s.status} />
          <Button asChild variant="outline">
            <Link href={`/admin/daily?month=${s.day.slice(0, 7)}`}>Calendar</Link>
          </Button>
        </>
      }
    >
      <StatGrid cols={3}>
        <StatsCard label="Check-ins" value={stats.logins} />
        <StatsCard label="Spins" value={stats.spins} />
        <StatsCard label="Mission bonuses" value={stats.bonus} />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <AdminCard title="Schedule">
          <ResourceEditor resource="dailySchedules" id={id} back={back} afterDelete={`/admin/daily?month=${s.day.slice(0, 7)}`} />
        </AdminCard>
        <AdminCard title="Player preview" description="Resolved plan, including defaults for anything left empty">
          <DailyPlanPreview plan={plan} />
        </AdminCard>
      </div>
    </AdminPage>
  );
}
