import { asc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard } from "@/components/admin/ui";
import { mapArt } from "@/components/app/art";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { bigMysteryBoxes, mapAreas, mapCheckpoints, maps, userCheckpoints, vaults } from "@/db/schema";
import { defaultTrail, densify, toPoints } from "@/lib/adventure-trails";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits } from "@/lib/money";
import { one, rows } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Mystery Map" };

export default async function MapPage({ params }: PageProps<"/admin/games/maps/[id]">) {
  await requireAdmin("games.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [map] = await db.select().from(maps).where(eq(maps.id, id)).limit(1);
  if (!map) notFound();
  const back = `/admin/games/maps/${id}`;
  const b = encodeURIComponent(back);
  if (map.level !== null) return <AdventureMapAdmin map={map} back={back} />;
  const [areas, areaStats, mapVaults, totals] = await Promise.all([
    db.select().from(mapAreas).where(eq(mapAreas.mapId, id)).orderBy(asc(mapAreas.sortOrder)),
    rows<{ id: string; tiles: number; discoveries: number; players: number; unlocks: number }>(sql`
      select a.id,
        (select count(*)::int from map_tiles t where t.area_id = a.id) as tiles,
        (select count(*)::int from tile_discoveries d where d.area_id = a.id) as discoveries,
        (select count(distinct user_id)::int from tile_discoveries d where d.area_id = a.id) as players,
        (select count(*)::int from area_unlocks u where u.area_id = a.id) as unlocks
      from map_areas a where a.map_id = ${id}`),
    db.select().from(vaults).where(eq(vaults.mapId, id)).orderBy(asc(vaults.sortOrder)),
    one<{ discoveries: number; players: number; spent: string; free: number }>(sql`
      select count(*)::int as discoveries, count(distinct user_id)::int as players, coalesce(sum(credits_spent), 0)::text as spent,
        count(*) filter (where used_free_discovery)::int as free
      from tile_discoveries where area_id in (select id from map_areas where map_id = ${id})`),
  ]);
  const st = new Map(areaStats.map((a) => [a.id, a]));

  return (
    <AdminPage title={map.name} description={`Content version ${map.version}. ${map.description}`} actions={<StatusBadge status={map.status} />}>
      <StatGrid cols={4}>
        <StatsCard label="Areas" value={areas.length} hint={`${areas.filter((a) => a.isSpecial).length} special`} />
        <StatsCard label="Tiles discovered" value={totals.discoveries.toLocaleString()} hint={`${totals.free} free discoveries`} />
        <StatsCard label="Explorers" value={totals.players} />
        <StatsCard label="Credits spent" value={formatCredits(totals.spent)} />
      </StatGrid>
      <AdminCard title="Map layout" description="Areas placed by their map position">
        <div className="relative overflow-x-auto">
          <div className="grid min-w-96 gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, ...areas.map((a) => a.posX + 1))}, minmax(0, 1fr))` }}>
            {areas.map((a) => (
              <Link
                key={a.id}
                href={`/admin/games/areas/${a.id}`}
                className="rounded-xl border p-3 text-sm hover:ring-2 hover:ring-primary/40"
                style={{ gridColumnStart: a.posX + 1, gridRowStart: a.posY + 1, background: `color-mix(in oklab, ${a.color} 14%, transparent)` }}
              >
                <p className="font-semibold">
                  {a.icon} {a.name}
                </p>
                <p className="text-xs text-muted-foreground">{a.isSpecial ? "Special Area" : `${a.gridCols}x${a.gridRows} tiles`}</p>
              </Link>
            ))}
          </div>
        </div>
      </AdminCard>
      <AdminCard
        title="Areas"
        bodyClassName="p-0"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/manage/areas/new?mapId=${id}&back=${b}`}>
              <Plus /> Add area
            </Link>
          </Button>
        }
      >
        <DataTable
          rows={areas}
          rowKey={(a) => a.id}
          empty="No areas yet"
          columns={[
            { key: "n", header: "Area", cell: (a) => <Link href={`/admin/games/areas/${a.id}`} className="font-medium text-primary hover:underline">{a.icon} {a.name}</Link> },
            { key: "s", header: "Type", cell: (a) => (a.isSpecial ? "Special" : "Standard") },
            { key: "c", header: "Cost", align: "right", cell: (a) => (a.discoveryCostCredits ? `${formatCredits(a.discoveryCostCredits)} Cr` : "Free") },
            { key: "t", header: "Tiles", align: "right", cell: (a) => st.get(a.id)?.tiles ?? 0 },
            { key: "d", header: "Discoveries", align: "right", cell: (a) => st.get(a.id)?.discoveries ?? 0 },
            { key: "p", header: "Players", align: "right", cell: (a) => st.get(a.id)?.players ?? 0 },
            { key: "u", header: "Unlocks", align: "right", cell: (a) => (a.isSpecial ? (st.get(a.id)?.unlocks ?? 0) : "-") },
            { key: "st", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
          ]}
        />
      </AdminCard>
      <AdminCard
        title="Vaults on this map"
        bodyClassName="p-0"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/manage/vaults/new?mapId=${id}&back=${b}`}>
              <Plus /> Add vault
            </Link>
          </Button>
        }
      >
        <DataTable
          rows={mapVaults}
          rowKey={(v) => v.id}
          empty="No vaults"
          columns={[
            { key: "n", header: "Vault", cell: (v) => <Link href={`/admin/games/vaults/${v.id}`} className="font-medium text-primary hover:underline">{v.icon} {v.name}</Link> },
            { key: "s", header: "Status", cell: (v) => <StatusBadge status={v.status} /> },
          ]}
        />
      </AdminCard>
      <AdminCard title="Map settings" description="Bump the content version when changing tile layout so historical discoveries stay interpretable.">
        <ResourceEditor resource="maps" id={id} back={back} />
      </AdminCard>
    </AdminPage>
  );
}

async function AdventureMapAdmin({ map, back }: { map: typeof maps.$inferSelect; back: string }) {
  const b = encodeURIComponent(back);
  const [cps, [bb], progress, cpCounts] = await Promise.all([
    db.select().from(mapCheckpoints).where(eq(mapCheckpoints.mapId, map.id)).orderBy(asc(mapCheckpoints.position)),
    db.select().from(bigMysteryBoxes).where(eq(bigMysteryBoxes.mapId, map.id)).limit(1),
    one<{ unlocked: number; completed: number }>(sql`
      select count(*)::int as unlocked, count(completed_at)::int as completed from user_map_progress where map_id = ${map.id}`),
    db
      .select({ checkpointId: userCheckpoints.checkpointId, n: sql<number>`count(*)::int` })
      .from(userCheckpoints)
      .where(eq(userCheckpoints.mapId, map.id))
      .groupBy(userCheckpoints.checkpointId),
  ]);
  const ordered = [...cps].sort((x, y) => Number(x.isFinal) - Number(y.isFinal) || x.position - y.position);
  const reached = new Map(cpCounts.map((c) => [c.checkpointId, Number(c.n)]));
  const previewLine = densify(defaultTrail(map.level, map.artwork) ?? [{ x: ordered[0]?.posX ?? 50, y: 100 }, ...ordered.map((c) => ({ x: c.posX, y: c.posY }))]);
  return (
    <AdminPage title={`Map ${map.level}: ${map.name}`} description={`Unlocks at ${map.lootRequired} Loot. ${map.description}`} actions={<StatusBadge status={map.status} />}>
      <StatGrid cols={4}>
        <StatsCard label="Checkpoints" value={cps.length} hint={cps.some((c) => c.isFinal) ? "Has a final checkpoint" : "No final checkpoint"} tone={cps.some((c) => c.isFinal) ? "default" : "warning"} />
        <StatsCard label="Players unlocked" value={progress.unlocked} />
        <StatsCard label="Players completed" value={progress.completed} tone="success" />
        <StatsCard label="Big Box odds (1/2/3)" value={bb ? `${bb.pieces1Pct}/${bb.pieces2Pct}/${bb.pieces3Pct}%` : "Missing"} tone={bb ? "default" : "warning"} href={bb ? `/admin/manage/bigBoxes/${bb.id}?back=${b}` : `/admin/manage/bigBoxes/new?mapId=${map.id}&back=${b}`} />
      </StatGrid>
      <AdminCard title="Layout preview" description="Checkpoint positions as players see them (X and Y from 0 to 100).">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-60 overflow-hidden rounded-xl border bg-cover bg-center" style={map.level === null && !map.artwork ? { background: `color-mix(in oklab, ${map.color} 16%, transparent)` } : { backgroundImage: `url(${mapArt(map.level ?? 1, map.artwork)})` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <polyline points={toPoints(previewLine)} fill="none" stroke="white" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {ordered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/manage/checkpoints/${c.id}?back=${b}`}
              className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow"
              style={{ left: `${c.posX}%`, top: `${c.posY}%`, background: c.isFinal ? "#f59e0b" : map.color }}
              title={c.name}
            >
              {c.isFinal ? "★" : c.position}
            </Link>
          ))}
        </div>
      </AdminCard>
      <AdminCard
        title="Checkpoints"
        bodyClassName="p-0"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/manage/checkpoints/new?mapId=${map.id}&back=${b}`}>
              <Plus /> Add checkpoint
            </Link>
          </Button>
        }
      >
        <DataTable
          rows={ordered}
          rowKey={(c) => c.id}
          empty="No checkpoints yet"
          columns={[
            { key: "o", header: "Order", cell: (c) => (c.isFinal ? "Final" : c.position) },
            { key: "n", header: "Checkpoint", cell: (c) => <Link href={`/admin/manage/checkpoints/${c.id}?back=${b}`} className="font-medium text-primary hover:underline">{c.name}</Link> },
            { key: "l", header: "Loot required", align: "right", cell: (c) => c.lootRequired },
            { key: "r", header: "Players reached", align: "right", cell: (c) => reached.get(c.id) ?? 0 },
            { key: "s", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
          ]}
        />
      </AdminCard>
      <AdminCard title="Map settings" description="Loot is a milestone: the unlock and checkpoint thresholds count total Loot collected for this level and nothing is consumed.">
        <ResourceEditor resource="maps" id={map.id} back={back} />
      </AdminCard>
    </AdminPage>
  );
}
