export type RarityKey = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

/** Literal colours on purpose: app themes remap the Tailwind palette, and tiers must stay distinguishable. */
export const RARITY: Record<RarityKey, { label: string; text: string; bg: string; ring: string; hex: string }> = {
  COMMON: { label: "Common", text: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-200", hex: "#64748b" },
  UNCOMMON: { label: "Uncommon", text: "text-[#047857]", bg: "bg-[#ecfdf5]", ring: "ring-[#a7f3d0]", hex: "#10b981" },
  RARE: { label: "Rare", text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", hex: "#0ea5e9" },
  EPIC: { label: "Epic", text: "text-[#6d28d9]", bg: "bg-[#f5f3ff]", ring: "ring-[#ddd6fe]", hex: "#8b5cf6" },
  LEGENDARY: { label: "Legendary", text: "text-[#b45309]", bg: "bg-[#fffbeb]", ring: "ring-[#fcd34d]", hex: "#f59e0b" },
};

export function rarityOf(value: string | null | undefined) {
  return RARITY[(value as RarityKey) ?? "COMMON"] ?? RARITY.COMMON;
}
