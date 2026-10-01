import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminCard, AdminPage, DataTable, StatGrid, StatsCard } from "@/components/admin/ui";
import { db } from "@/db";
import { bigMysteryBoxes, gameEvents, mapCheckpoints, maps, mysteryBoxes, prizes, puzzles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatCredits, formatMYR } from "@/lib/money";
import { adventureConfigWarnings } from "@/server/services/adventure";
import { getConfig } from "@/server/services/config";

export const metadata: Metadata = { title: "Adventure" };

const m = (key: string, id?: string) => (id ? `/admin/manage/${key}/${id}` : `/admin/manage/${key}`);

export default async function AdventureAdminPage() {
  await requireAdmin("games.manage");
  const [boxRows, mapRows, cps, bbs, puzzleRows, prizeRows, wheel, warnings, funnel] = await Promise.all([
    db.select().from(mysteryBoxes).where(isNotNull(mysteryBoxes.level)).orderBy(asc(mysteryBoxes.level)),
    db.select().from(maps).where(isNotNull(maps.level)).orderBy(asc(maps.level)),
    db.select().from(mapCheckpoints).where(eq(mapCheckpoints.status, "PUBLISHED")),
    db.select().from(bigMysteryBoxes),
    db.select().from(puzzles).orderBy(asc(puzzles.level)),
    db.select().from(prizes),
    getConfig("prize_wheel"),
    adventureConfigWarnings(),
    db
      .select({ type: gameEvents.type, players: sql<number>`count(distinct ${gameEvents.userId})::int`, n: sql<number>`count(*)::int` })
      .from(gameEvents)
      .groupBy(gameEvents.type),
  ]);
  const levels = Array.from(new Set([...boxRows.map((b) => b.level as number), ...mapRows.map((x) => x.level as number), ...puzzleRows.map((p) => p.level)])).sort((a, b) => a - b);
  const f = (t: string) => funnel.find((x) => x.type === t);

  const rows = levels.map((level) => {
    const box = boxRows.find((b) => b.level === level);
    const map = mapRows.find((x) => x.level === level);
    const mine = map ? cps.filter((c) => c.mapId === map.id) : [];
    const final = mine.find((c) => c.isFinal);
    const bb = map ? bbs.find((b) => b.mapId === map.id) : undefined;
    const puzzle = puzzleRows.find((p) => p.level === level);
    const prize = puzzle ? prizeRows.find((p) => p.id === puzzle.prizeId) : undefined;
    return { level, box, map, checkpoints: mine.length, final, bb, puzzle, prize };
  });

  return (
    <AdminPage
      title="Adventure"
      description="The 10-level progression: Mystery Box, Loot, Map, checkpoints, Big Mystery Box, puzzle and Final Prize Unlock. Loot is a milestone: thresholds count total Loot collected for that level and nothing is consumed."
    >
      <StatGrid cols={4}>
        <StatsCard label="Players who opened a box" value={f("MYSTERY_BOX_PURCHASE")?.players ?? 0} hint={`${f("MYSTERY_BOX_PURCHASE")?.n ?? 0} boxes opened`} />
        <StatsCard label="Maps completed" value={f("MAP_COMPLETION")?.n ?? 0} hint={`${f("MAP_COMPLETION")?.players ?? 0} players`} />
        <StatsCard label="Puzzles completed" value={f("PUZZLE_COMPLETED")?.n ?? 0} />
        <StatsCard label="Final unlocks" value={f("PRIZE_UNLOCK_RESULT")?.n ?? 0} hint={<Link href="/admin/games/prize-claims" className="underline">View prize claims</Link>} />
      </StatGrid>

      <AdminCard
        title="Configuration checks"
        description="Problems players would run into. Fix these before publishing new levels."
      >
        {warnings.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> Every published level is complete and valid.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard
        title="Final Prize Unlock"
        description="Applies to every level. Odds are shown to players before they unlock."
        actions={
          <Link href="/admin/economy/settings/prize_wheel" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Edit
          </Link>
        }
      >
        <p className="text-sm">
          {wheel.active ? "Active" : "Paused"} · Prize {wheel.prizeUnlockPct}% · Alternative reward {wheel.alternativePct}%
          {wheel.prizeUnlockPct + wheel.alternativePct !== 100 && <span className="ml-2 font-medium text-red-600">Does not total 100%. Unlocks are paused.</span>}
        </p>
      </AdminCard>

      <AdminCard title="Levels" description="Click any value to edit it." bodyClassName="p-0">
        <DataTable
          rows={rows}
          rowKey={(r) => String(r.level)}
          empty="No adventure levels yet. Run the adventure seed or create boxes and maps with a level."
          columns={[
            { key: "l", header: "Level", cell: (r) => <span className="font-semibold">{r.level}</span> },
            {
              key: "b",
              header: "Mystery Box",
              cell: (r) =>
                r.box ? (
                  <Link href={`/admin/games/boxes/${r.box.id}`} className="hover:underline">
                    {r.box.name}
                    <span className="block text-xs text-muted-foreground">
                      {formatCredits(r.box.priceCredits)} Credits · {r.box.requiresMapLevel ? `after Map ${r.box.requiresMapLevel}` : "open from start"}
                      {r.box.status !== "PUBLISHED" && ` · ${r.box.status.toLowerCase()}`}
                    </span>
                  </Link>
                ) : (
                  <Link href={m("boxes")} className="text-amber-700 hover:underline">Missing</Link>
                ),
            },
            {
              key: "m",
              header: "Map",
              cell: (r) =>
                r.map ? (
                  <Link href={`/admin/games/maps/${r.map.id}`} className="hover:underline">
                    {r.map.name}
                    <span className="block text-xs text-muted-foreground">
                      Unlock at {r.map.lootRequired} Loot · {r.checkpoints} checkpoints · finish at {r.final?.lootRequired ?? "?"}
                    </span>
                  </Link>
                ) : (
                  <Link href={m("maps")} className="text-amber-700 hover:underline">Missing</Link>
                ),
            },
            {
              key: "bb",
              header: "Big Box odds (1/2/3)",
              cell: (r) =>
                r.bb ? (
                  <Link href={m("bigBoxes", r.bb.id)} className="whitespace-nowrap hover:underline">
                    {r.bb.pieces1Pct}/{r.bb.pieces2Pct}/{r.bb.pieces3Pct}%{!r.bb.active && " · off"}
                  </Link>
                ) : (
                  "-"
                ),
            },
            {
              key: "p",
              header: "Puzzle",
              cell: (r) =>
                r.puzzle ? (
                  <Link href={m("puzzles", r.puzzle.id)} className="hover:underline">
                    {r.puzzle.piecesRequired} pieces
                    <span className="block text-xs text-muted-foreground">
                      Alt: {r.puzzle.alternativeRewardType === "CREDITS" ? `${formatCredits(r.puzzle.alternativeRewardAmount)} Credits` : formatMYR(r.puzzle.alternativeRewardAmount)}
                    </span>
                  </Link>
                ) : (
                  "-"
                ),
            },
            {
              key: "pr",
              header: "Prize",
              cell: (r) =>
                r.prize ? (
                  <Link href={m("prizes", r.prize.id)} className="hover:underline">
                    {r.prize.name}
                    <span className="block text-xs text-muted-foreground">
                      {r.prize.inventoryTotal === null ? "Unlimited" : `${r.prize.inventoryTotal - r.prize.inventoryAllocated} of ${r.prize.inventoryTotal} left`}
                      {!r.prize.active && " · inactive"}
                    </span>
                  </Link>
                ) : (
                  "-"
                ),
            },
          ]}
        />
      </AdminCard>
    </AdminPage>
  );
}
