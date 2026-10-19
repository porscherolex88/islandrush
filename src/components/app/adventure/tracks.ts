import type { AdventureMapView, AdventureState } from "@/server/services/adventure";
import type { TrackLevel } from "./level-track";

/** Loot progress toward the map's next checkpoint chest. */
export function mapLootGoal(map: AdventureMapView) {
  const target = map.nextLootTarget;
  const label = map.state === "exploring" ? "Loot for the next checkpoint" : `${map.name} Loot`;
  return { have: map.lootCollected, target, label };
}

/** Boxes are never "done": players can keep opening any unlocked box. Progress lives on the maps. */
export function boxTrack(s: AdventureState): (TrackLevel & { state: Exclude<TrackLevel["state"], "done"> })[] {
  return s.boxes.map((b) => ({
    level: b.level,
    state: b.locked ? "locked" : b.id === s.currentBox?.id ? "current" : "open",
    label: b.locked ? `${b.name}, locked` : b.name,
  }));
}

export function mapTrack(s: AdventureState): TrackLevel[] {
  return s.maps.map((m) => ({
    level: m.level,
    state: m.cleared ? "done" : m.id === s.currentMap?.id ? "current" : m.state === "locked" ? "locked" : "open",
    label: `${m.name}, ${m.cleared ? "completed" : m.state === "locked" ? "locked" : "in progress"}`,
  }));
}

/**
 * The box to show by default: the current map's box, since only its Loot moves that map forward.
 * Falls back to the highest open box the player can pay for, else the lowest open box.
 */
export function defaultBox(s: AdventureState, credits: number) {
  const open = s.boxes.filter((b) => !b.locked);
  const current = open.find((b) => b.level === s.currentMap?.level);
  return current ?? open.findLast((b) => b.priceCredits <= credits) ?? open[0] ?? s.currentBox;
}

export function levelParam(raw: string | string[] | undefined, fallback: number, max: number) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
}
