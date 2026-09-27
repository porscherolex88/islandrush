import { eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PoolTable } from "@/components/admin/pool-table";
import { RequirementsCard } from "@/components/admin/requirements-card";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, StatGrid, StatsCard } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { mapAreas, maps, mapTiles, rewardPools } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { poolDistribution } from "@/server/admin/pools";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Map area" };

export default async function AreaPage({ params }: PageProps<"/admin/games/areas/[id]">) {
  await requireAdmin("games.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select({ a: mapAreas, map: maps }).from(mapAreas).innerJoin(maps, eq(maps.id, mapAreas.mapId)).where(eq(mapAreas.id, id)).limit(1);
  if (!row) notFound();
  const { a, map } = row;
  const back = `/admin/games/areas/${id}`;
  const b = encodeURIComponent(back);
  const [tiles, tileStats, stats, pool] = await Promise.all([
    db.select().from(mapTiles).where(eq(mapTiles.areaId, id)),
    rows<{ id: string; n: number }>(sql`select tile_id as id, count(*)::int as n from tile_discoveries where area_id = ${id} group by 1`),
    one<{ discoveries: number; players: number; spent: string; unlocks: number; completed: number }>(sql`
      select count(*)::int as discoveries, count(distinct user_id)::int as players, coalesce(sum(credits_spent), 0)::text as spent,
        (select count(*)::int from area_unlocks where area_id = ${id}) as unlocks,
        (select count(*)::int from (
          select user_id from tile_discoveries where area_id = ${id} group by user_id
          having count(*) >= (select count(*) from map_tiles where area_id = ${id} and status = 'PUBLISHED')
        ) c) as completed
      from tile_discoveries where area_id = ${id}`),
    a.discoveryPoolId ? db.select().from(rewardPools).where(eq(rewardPools.id, a.discoveryPoolId)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);
  const dist = pool ? await poolDistribution(pool.id, pool.mode) : null;
  const byPos = new Map(tiles.map((t) => [`${t.row}-${t.col}`, t]));
  const counts = new Map(tileStats.map((t) => [t.id, t.n]));
  const outside = tiles.filter((t) => t.row >= a.gridRows || t.col >= a.gridCols);

  return (
    <AdminPage
      title={`${a.icon} ${a.name}`}
      description={`${a.isSpecial ? "Special Area" : "Area"} on ${map.name} · ${a.discoveryCostCredits ? `${formatCredits(a.discoveryCostCredits)} Credits per tile` : "Free discoveries"}`}
      actions={
        <>
          <StatusBadge status={a.status} />
          <Button asChild variant="outline">
            <Link href={`/admin/games/maps/${map.id}`}>Back to map</Link>
          </Button>
        </>
      }
    >
      <StatGrid cols={5}>
        <StatsCard label="Tiles" value={tiles.length} hint={`${a.gridCols}x${a.gridRows} grid`} />
        <StatsCard label="Discoveries" value={stats.discoveries.toLocaleString()} />
        <StatsCard label="Players" value={stats.players} hint={`${stats.completed} fully explored`} />
        <StatsCard label="Credits spent" value={formatCredits(stats.spent)} />
        <StatsCard label="Unlocks" value={a.isSpecial ? stats.unlocks : "Open"} />
      </StatGrid>
      <AdminCard title="Tile grid" description="Click a tile to edit it, or an empty cell to place a new tile. Numbers show total discoveries.">
        <div className="overflow-x-auto">
          <div className="grid min-w-80 gap-2" style={{ gridTemplateColumns: `repeat(${a.gridCols}, minmax(4.5rem, 1fr))` }}>
            {Array.from({ length: a.gridRows * a.gridCols }, (_, i) => {
              const r = Math.floor(i / a.gridCols);
              const c = i % a.gridCols;
              const t = byPos.get(`${r}-${c}`);
              return t ? (
                <Link
                  key={i}
                  href={`/admin/manage/tiles/${t.id}?back=${b}`}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-center hover:ring-2 hover:ring-primary/40"
                  style={{ background: `color-mix(in oklab, ${a.color} ${t.status === "PUBLISHED" ? 16 : 4}%, transparent)` }}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="line-clamp-1 text-[11px] font-medium">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {counts.get(t.id) ?? 0}
                    {t.costCreditsOverride !== null ? ` · ${formatCredits(t.costCreditsOverride)} Cr` : ""}
                  </span>
                </Link>
              ) : (
                <Link
                  key={i}
                  href={`/admin/manage/tiles/new?areaId=${id}&row=${r}&col=${c}&back=${b}`}
                  aria-label={`Add tile at row ${r + 1}, column ${c + 1}`}
                  className="flex aspect-square items-center justify-center rounded-xl border border-dashed text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  <Plus className="size-4" />
                </Link>
              );
            })}
          </div>
        </div>
        {outside.length > 0 && (
          <p className="mt-3 text-sm text-amber-600">
            {outside.length} tile{outside.length === 1 ? " is" : "s are"} outside the grid size and hidden from players:{" "}
            {outside.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ", "}
                <Link href={`/admin/manage/tiles/${t.id}?back=${b}`} className="underline">
                  {t.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </AdminCard>
      {a.isSpecial && <RequirementsCard ownerType="AREA" ownerId={id} back={back} description="All requirements must be met before players can unlock this Special Area." />}
      {dist && pool && (
        <AdminCard
          title={`Discovery pool: ${pool.name}`}
          bodyClassName="p-0"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/economy/pools/${pool.id}`}>Edit pool</Link>
            </Button>
          }
        >
          <PoolTable stats={dist.stats} back={`/admin/economy/pools/${pool.id}`} />
        </AdminCard>
      )}
      <AdminCard title="Area settings">
        <ResourceEditor resource="areas" id={id} back={back} afterDelete={`/admin/games/maps/${map.id}`} />
      </AdminCard>
    </AdminPage>
  );
}
