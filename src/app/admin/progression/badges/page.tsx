import { sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Badges" };

export default async function BadgesPage() {
  await requireAdmin("progression.manage");
  const [badges, players] = await Promise.all([
    rows<{ id: string; name: string; badge_name: string; badge_icon: string; condition: string; threshold: number; active: boolean; earned: number; last: string | null }>(sql`
      select a.id, a.name, a.badge_name, a.badge_icon, a.condition::text, a.threshold, a.active,
        count(u.id)::int as earned, max(u.created_at)::text as last
      from achievements a left join user_achievements u on u.achievement_id = a.id
      group by a.id order by a.condition, a.threshold`),
    rows<{ n: number }>(sql`select count(*)::int as n from profiles where role = 'USER'`),
  ]);
  const total = players[0]?.n ?? 0;
  const back = encodeURIComponent("/admin/progression/badges");
  return (
    <AdminPage
      title="Badges"
      description="Badges are awarded by achievements. Edit the achievement to change the badge, condition or reward."
      actions={
        <Button asChild>
          <Link href={`/admin/manage/achievements/new?back=${back}`}>
            <Plus /> New achievement
          </Link>
        </Button>
      }
    >
      <AdminCard>
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No achievements yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {badges.map((b) => (
              <Link key={b.id} href={`/admin/manage/achievements/${b.id}?back=${back}`} className={cn("rounded-xl border p-4 transition hover:ring-2 hover:ring-primary/40", !b.active && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{b.badge_icon}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.badge_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {b.condition.replace(/_/g, " ").toLowerCase()} ≥ {b.threshold}
                  {!b.active && " · inactive"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${total ? Math.min(100, (b.earned / total) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs tabular-nums">{b.earned} earned</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
