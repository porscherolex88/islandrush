/**
 * Adventure progression rules shared by the server and the UI.
 *
 * Loot and puzzle pieces follow one model: they are cumulative milestones.
 * Loot stays in the player's collection; a map or checkpoint requirement is a
 * threshold on the total Loot collected for that map. Puzzle pieces likewise
 * accumulate, and each puzzle covers the next slice of the running total.
 */

export const ADVENTURE_LEVELS = 10;

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

export function roman(level: number) {
  return ROMAN[level - 1] ?? String(level);
}

const LOOT_EMOJI: Record<string, string> = {
  shell: "🐚",
  pearl: "🦪",
  leaf: "🌿",
  idol: "🗿",
  relic: "🏺",
  scroll: "📜",
  fragment: "🪨",
  key: "🗝️",
  crystal: "🔮",
  shard: "💎",
  coin: "🪙",
  crown: "👑",
  seal: "🏵️",
  compass: "🧭",
  feather: "🪶",
  banner: "🚩",
  scale: "🐉",
  ember: "🔥",
  map: "🗺️",
  jewel: "💍",
  gem: "💎",
};

/** Emoji for a Loot icon key. Unknown values (e.g. an emoji set by an admin) pass through unchanged. */
export function lootEmoji(icon: string): string {
  return LOOT_EMOJI[icon.toLowerCase()] ?? icon;
}

/** True when every value is a whole number >= 0 and they add up to exactly 100. */
export function isValidPercentSplit(values: number[]): boolean {
  return values.length > 0 && values.every((v) => Number.isInteger(v) && v >= 0) && values.reduce((s, v) => s + v, 0) === 100;
}

export type PuzzleSlot = { id: string; level: number; piecesRequired: number };

/**
 * Splits a running total of pieces across puzzles in level order. Puzzle N shows
 * the pieces left over after puzzles before it are full, capped at its own size.
 */
export function allocatePieces<T extends PuzzleSlot>(puzzles: T[], totalPieces: number) {
  let before = 0;
  return [...puzzles]
    .sort((a, b) => a.level - b.level)
    .map((p) => {
      const have = Math.max(0, Math.min(p.piecesRequired, totalPieces - before));
      const out = { ...p, piecesBefore: before, piecesHave: have, piecesFull: have >= p.piecesRequired };
      before += p.piecesRequired;
      return out;
    });
}

export type CheckpointState = "locked" | "available" | "completed";

/** A checkpoint is available when every earlier one is done and enough Loot has been collected. */
export function checkpointStates(
  checkpoints: { id: string; position: number; lootRequired: number; isFinal: boolean }[],
  completed: Set<string>,
  lootCollected: number,
  mapUnlocked: boolean,
): Map<string, CheckpointState> {
  const ordered = [...checkpoints].sort((a, b) => Number(a.isFinal) - Number(b.isFinal) || a.position - b.position);
  const out = new Map<string, CheckpointState>();
  let blocked = !mapUnlocked;
  for (const cp of ordered) {
    if (completed.has(cp.id)) {
      out.set(cp.id, "completed");
      continue;
    }
    out.set(cp.id, !blocked && lootCollected >= cp.lootRequired ? "available" : "locked");
    blocked = true;
  }
  return out;
}

export function pct(n: number, d: number) {
  return d <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}
