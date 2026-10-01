import type { AdventureState } from "@/server/services/adventure";
import type { TrackLevel } from "./level-track";

export function boxTrack(s: AdventureState): TrackLevel[] {
  return s.boxes.map((b) => ({
    level: b.level,
    state: b.completed ? "done" : b.locked ? "locked" : b.id === s.currentBox?.id ? "current" : "open",
    label: b.completed ? `${b.name}, completed` : b.locked ? `${b.name}, locked` : b.name,
  }));
}

export function mapTrack(s: AdventureState): TrackLevel[] {
  return s.maps.map((m) => ({
    level: m.level,
    state: m.state === "completed" ? "done" : m.id === s.currentMap?.id ? "current" : m.state === "locked" ? "locked" : "open",
    label: `${m.name}, ${m.state === "completed" ? "completed" : m.state === "locked" ? "locked" : "in progress"}`,
  }));
}

export function levelParam(raw: string | string[] | undefined, fallback: number, max: number) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
}
