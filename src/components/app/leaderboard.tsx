"use client";

import { Crown, Flame, Gem, Trophy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Leaderboard as Board, Leaderboards, LeaderboardRow } from "@/server/queries/leaderboard";

const BOARDS = {
  loot: { label: "Loot", icon: Gem, unit: "Loot", empty: "Open a Mystery Box to get on the board." },
  streak: { label: "Streak", icon: Flame, unit: "days", empty: "Check in today to start a streak." },
} as const;
type Key = keyof typeof BOARDS;

const PODIUM = [
  { place: 2, height: "h-16", ring: "ring-slate-300", medal: "bg-slate-200 text-slate-700" },
  { place: 1, height: "h-24", ring: "ring-amber-300", medal: "bg-[linear-gradient(180deg,oklch(0.86_0.15_85),oklch(0.76_0.16_70))] text-[oklch(0.3_0.08_55)]" },
  { place: 3, height: "h-12", ring: "ring-orange-300", medal: "bg-orange-200 text-orange-800" },
];

function initial(name: string) {
  return name === "You" ? "Y" : (Array.from(name)[0] ?? "?").toUpperCase();
}

function Avatar({ row, className }: { row: LeaderboardRow; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-heading font-extrabold", row.isMe ? "bg-primary text-primary-foreground" : "bg-brand-soft text-primary", className)} aria-hidden>
      {initial(row.name)}
    </span>
  );
}

function Podium({ board, unit }: { board: Board; unit: string }) {
  return (
    <ol className="grid grid-cols-3 items-end gap-2 px-1 pt-2" aria-label="Top three">
      {PODIUM.map(({ place, height, ring, medal }) => {
        const row = board.top.find((r) => r.rank === place);
        return (
          <li key={place} className="flex min-w-0 flex-col items-center text-center">
            {row ? (
              <>
                {place === 1 && <Crown className="mb-0.5 size-5 text-gold" aria-hidden />}
                <Avatar row={row} className={cn("ring-4", ring, place === 1 ? "size-14 text-xl" : "size-11 text-base")} />
                <p className={cn("mt-1.5 w-full truncate text-xs font-bold", row.isMe && "text-primary")}>{row.name}</p>
                <p className="text-[11px] font-semibold text-muted-foreground tabular">
                  {row.score.toLocaleString("en-MY")} {unit}
                </p>
              </>
            ) : (
              <span className="size-11 rounded-full bg-muted" aria-hidden />
            )}
            <span className={cn("mt-2 flex w-full justify-center rounded-t-2xl pt-1.5 font-heading text-lg font-extrabold", height, medal)} aria-label={`Place ${place}`}>
              {place}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ row, unit }: { row: LeaderboardRow; unit: string }) {
  return (
    <li className={cn("flex items-center gap-3 px-3.5 py-2.5", row.isMe && "bg-brand-soft/70")}>
      <span className="w-6 text-center text-sm font-bold text-muted-foreground tabular">{row.rank}</span>
      <Avatar row={row} className="size-8 text-sm" />
      <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", row.isMe && "text-primary")}>{row.name}</span>
      <span className="text-sm font-bold tabular">
        {row.score.toLocaleString("en-MY")} <span className="text-xs font-semibold text-muted-foreground">{unit}</span>
      </span>
    </li>
  );
}

/** Home leaderboard: top players by Loot found or current streak, with the viewer's own rank pinned. */
export function Leaderboard({ boards }: { boards: Leaderboards }) {
  const [key, setKey] = useState<Key>("loot");
  const board = boards[key];
  const { unit, empty } = BOARDS[key];
  const rest = board.top.filter((r) => r.rank > 3);
  const meOutside = board.me && board.me.rank > 10 ? board.me : null;

  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Trophy className="size-4 text-gold" aria-hidden /> Top explorers
        </p>
        <div role="tablist" aria-label="Leaderboard" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(Object.keys(BOARDS) as Key[]).map((k) => {
            const Icon = BOARDS[k].icon;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={key === k}
                onClick={() => setKey(k)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1 rounded-full px-3 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  key === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden /> {BOARDS[k].label}
              </button>
            );
          })}
        </div>
      </div>

      {board.top.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <Podium board={board} unit={unit} />
          {rest.length > 0 && (
            <ol className="divide-y border-t" aria-label="Places 4 to 10">
              {rest.map((r) => (
                <Row key={r.rank} row={r} unit={unit} />
              ))}
            </ol>
          )}
        </>
      )}

      {meOutside ? (
        <ol className="border-t-2 border-dashed" aria-label="Your rank">
          <Row row={meOutside} unit={unit} />
        </ol>
      ) : (
        !board.me && <p className="border-t bg-surface/60 px-3.5 py-2.5 text-xs text-muted-foreground">You&apos;re not on this board yet. {empty}</p>
      )}
    </div>
  );
}
