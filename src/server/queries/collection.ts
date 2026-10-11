import "server-only";
import { getProgress } from "@/server/queries/progress";
import { getAdventureState } from "@/server/services/adventure";
import { getMyListings, getSellableItems } from "@/server/services/market";
import type { Profile } from "@/server/services/profiles";

/**
 * Everything a player owns, split by whether it can be traded on the Market.
 * Sellable: any published item held in inventory (Loot and other items).
 * Keepsakes: progress that is not an item and can never be sold (puzzle pieces,
 * unlocked prizes, achievement badges and completed maps).
 */
export async function getCollection(user: Profile) {
  const [owned, listings, adventure, progress] = await Promise.all([getSellableItems(user.id), getMyListings(user.id), getAdventureState(user.id), getProgress(user)]);

  const ownedById = new Map(owned.map((i) => [i.id, i.quantity]));
  const listedById = new Map<string, number>();
  for (const l of listings) listedById.set(l.item.id, (listedById.get(l.item.id) ?? 0) + l.quantity);

  const lootMaps = adventure.maps
    .filter((m) => m.state !== "locked" || m.lootItems.some((i) => i.collected > 0) || m.id === adventure.currentMap?.id)
    .map((m) => ({
      id: m.id,
      level: m.level,
      name: m.name,
      artwork: m.artwork,
      state: m.state,
      items: m.lootItems.map((i) => ({ ...i, owned: ownedById.get(i.id) ?? 0, listed: listedById.get(i.id) ?? 0 })),
    }));
  const lockedMapCount = adventure.maps.length - lootMaps.length;

  const lootIds = new Set(adventure.maps.flatMap((m) => m.lootItems.map((i) => i.id)));
  const otherItems = owned.filter((i) => !lootIds.has(i.id)).map((i) => ({ ...i, listed: listedById.get(i.id) ?? 0 }));

  const puzzles = adventure.puzzles.filter((p) => p.complete || p.piecesHave > 0);
  const unlocks = adventure.puzzles
    .filter((p) => p.attempt)
    .map((p) => ({
      id: p.id,
      level: p.level,
      title: p.attempt!.outcome === "PRIZE" ? p.prize.name : (p.attempt!.alternativeDisplay ?? p.alternative.display),
      image: p.attempt!.outcome === "PRIZE" ? (p.prize.image ?? p.image) : p.image,
      kind: p.attempt!.outcome,
      claimStatus: p.claim?.status ?? null,
    }));
  const badges = progress.achievements;
  const earnedBadges = badges.filter((a) => a.earnedAt);
  const completedMaps = adventure.maps.filter((m) => m.state === "completed");

  const sellableUnits = owned.reduce((n, i) => n + i.quantity, 0);
  const keepsakeCount = adventure.totalPieces + unlocks.length + earnedBadges.length + completedMaps.length;

  return {
    lootMaps,
    lockedMapCount,
    otherItems,
    listings,
    puzzles,
    totalPieces: adventure.totalPieces,
    unlocks,
    badges,
    earnedBadges: earnedBadges.length,
    completedMaps,
    stats: [
      ...progress.stats.map((s) => ({ label: s.label, value: s.value, suffix: s.condition === "STREAK_DAYS" ? " days" : undefined })),
      { label: "Maps completed", value: adventure.completedMaps },
      { label: "Checkpoints reached", value: adventure.maps.reduce((n, m) => n + m.checkpointsDone, 0) },
    ] as { label: string; value: number; suffix?: string }[],
    counts: { sellable: sellableUnits, keepsakes: keepsakeCount, listed: listings.reduce((n, l) => n + l.quantity, 0) },
  };
}

export type CollectionData = Awaited<ReturnType<typeof getCollection>>;
