export type RarityKey = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

export const RARITY: Record<RarityKey, { label: string; text: string; bg: string; ring: string; hex: string }> = {
  COMMON: { label: "Common", text: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-200", hex: "#64748b" },
  UNCOMMON: { label: "Uncommon", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", hex: "#10b981" },
  RARE: { label: "Rare", text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", hex: "#0ea5e9" },
  EPIC: { label: "Epic", text: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200", hex: "#8b5cf6" },
  LEGENDARY: { label: "Legendary", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-300", hex: "#f59e0b" },
};

export function rarityOf(value: string | null | undefined) {
  return RARITY[(value as RarityKey) ?? "COMMON"] ?? RARITY.COMMON;
}
