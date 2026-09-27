import { randomInt } from "node:crypto";

/** Cryptographically secure weighted pick. Entries with weight <= 0 are never chosen. */
export function weightedPick<T extends { weight: number }>(entries: T[], rand: (max: number) => number = randomInt): T | null {
  const eligible = entries.filter((e) => e.weight > 0);
  const total = eligible.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;
  let roll = rand(total);
  for (const entry of eligible) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return eligible[eligible.length - 1];
}

export function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
