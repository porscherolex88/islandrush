import { asc, eq, isNotNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable } from "@/components/admin/ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/db";
import { mapAreas, mapTiles, mysteryBoxes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { creditsToCashMinor, formatCredits, formatMYR, toMinor } from "@/lib/money";
import { getConfig } from "@/server/services/config";

export const metadata: Metadata = { title: "Game pricing" };

export default async function PricingPage() {
  await requireAdmin("economy.manage");
  const [conversion, boxes, areas, overrides] = await Promise.all([
    getConfig("conversion"),
    db.select().from(mysteryBoxes).orderBy(asc(mysteryBoxes.sortOrder)),
    db.select({ a: mapAreas, tiles: sql<number>`(select count(*)::int from map_tiles t where t.area_id = ${mapAreas.id})` }).from(mapAreas).orderBy(asc(mapAreas.sortOrder)),
    db.select({ id: mapTiles.id, name: mapTiles.name, cost: mapTiles.costCreditsOverride, area: mapAreas.name }).from(mapTiles).innerJoin(mapAreas, eq(mapAreas.id, mapTiles.areaId)).where(isNotNull(mapTiles.costCreditsOverride)),
  ]);
  const cash = toMinor(conversion.cash);
  const cr = BigInt(conversion.credits);
  const rm = (credits: number) => formatMYR(creditsToCashMinor(BigInt(credits), cash, cr));
  const back = "&back=/admin/economy/pricing";
  return (
    <AdminPage title="Game pricing" description={`RM values use the current rate of ${formatMYR(conversion.cash)} = ${formatCredits(conversion.credits)} Credits. Price changes require a reason and are audited.`}>
      <AdminCard title="Mystery Boxes" bodyClassName="p-0">
        <DataTable
          rows={boxes}
          rowKey={(b) => b.id}
          columns={[
            { key: "n", header: "Box", cell: (b) => <Link href={`/admin/games/boxes/${b.id}`} className="font-medium text-primary hover:underline">{b.name}</Link> },
            { key: "s", header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
            { key: "p", header: "Price", align: "right", cell: (b) => `${formatCredits(b.priceCredits)} Cr` },
            { key: "rm", header: "RM value", align: "right", cell: (b) => rm(b.priceCredits) },
            { key: "l", header: "Daily limit", align: "right", cell: (b) => b.dailyLimitPerUser ?? "None" },
            { key: "e", header: "", cell: (b) => <Link href={`/admin/manage/boxes/${b.id}?x=1${back}`} className="text-xs text-primary">Edit price</Link> },
          ]}
        />
      </AdminCard>
      <AdminCard title="Map discovery costs" bodyClassName="p-0">
        <DataTable
          rows={areas}
          rowKey={(r) => r.a.id}
          columns={[
            { key: "n", header: "Area", cell: (r) => <Link href={`/admin/games/areas/${r.a.id}`} className="font-medium text-primary hover:underline">{r.a.icon} {r.a.name}</Link> },
            { key: "t", header: "Tiles", align: "right", cell: (r) => r.tiles },
            { key: "p", header: "Cost per tile", align: "right", cell: (r) => (r.a.discoveryCostCredits ? `${formatCredits(r.a.discoveryCostCredits)} Cr` : "Free") },
            { key: "rm", header: "RM value", align: "right", cell: (r) => (r.a.discoveryCostCredits ? rm(r.a.discoveryCostCredits) : "-") },
            { key: "e", header: "", cell: (r) => <Link href={`/admin/manage/areas/${r.a.id}?x=1${back}`} className="text-xs text-primary">Edit cost</Link> },
          ]}
        />
      </AdminCard>
      <AdminCard title="Tile cost overrides" bodyClassName="p-0">
        <DataTable
          rows={overrides}
          rowKey={(t) => t.id}
          empty="No tiles override their area cost"
          columns={[
            { key: "a", header: "Area", cell: (t) => t.area },
            { key: "n", header: "Tile", cell: (t) => <Link href={`/admin/manage/tiles/${t.id}?x=1${back}`} className="text-primary hover:underline">{t.name}</Link> },
            { key: "c", header: "Cost", align: "right", cell: (t) => `${formatCredits(t.cost ?? 0)} Cr` },
            { key: "rm", header: "RM value", align: "right", cell: (t) => rm(t.cost ?? 0) },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
