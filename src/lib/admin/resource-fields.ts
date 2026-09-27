import type { Permission } from "@/lib/permissions";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "credits"
  | "boolean"
  | "select"
  | "relation"
  | "json"
  | "list"
  | "date"
  | "datetime"
  | "color";

export type RelationKey = "pools" | "items" | "collections" | "maps" | "areas" | "vaults" | "missions" | "owners";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  relation?: RelationKey;
  help?: string;
  /** Primary-key style fields that cannot change after creation. */
  immutable?: boolean;
  default?: unknown;
  wide?: boolean;
};

export type ResourceDef = {
  key: string;
  label: string;
  singular: string;
  permission: Permission;
  pk: string;
  fields: FieldDef[];
  columns: string[];
  searchFields?: string[];
  /** Changes require a written reason and produce old/new audit records. */
  significant?: boolean;
  deletable?: boolean;
  /** Custom detail page used instead of the generic editor, e.g. "/admin/games/boxes/:id". */
  detailPath?: string;
  group: string;
  description?: string;
};

const STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const RARITY = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"] as const;
const status = (d: string = "PUBLISHED"): FieldDef => ({ name: "status", label: "Status", type: "select", options: STATUS, default: d, required: true });
const sort: FieldDef = { name: "sortOrder", label: "Sort order", type: "number", default: 0 };
const slug: FieldDef = { name: "slug", label: "Slug", type: "text", required: true, help: "Lowercase letters, numbers and hyphens. Used in URLs." };
const pool = (name: string, label: string, required = false): FieldDef => ({ name, label, type: "relation", relation: "pools", required });

export const RESOURCES = {
  paymentAccounts: {
    key: "paymentAccounts",
    label: "Payment accounts",
    singular: "Payment account",
    group: "Finance",
    permission: "deposits.manage",
    pk: "id",
    description: "Company bank accounts shown to players on the deposit page.",
    fields: [
      { name: "bankName", label: "Bank", type: "text", required: true },
      { name: "accountName", label: "Account name", type: "text", required: true },
      { name: "accountNumber", label: "Account number", type: "text", required: true },
      { name: "instructions", label: "Instructions", type: "textarea", default: "", wide: true },
      { name: "active", label: "Active", type: "boolean", default: true },
      sort,
    ],
    columns: ["bankName", "accountName", "accountNumber", "active", "sortOrder"],
    significant: true,
  },
  pools: {
    key: "pools",
    label: "Reward pools",
    singular: "Reward pool",
    group: "Economy",
    permission: "economy.manage",
    pk: "id",
    description: "Weighted reward tables used by boxes, tiles, spins, events, vaults and milestones.",
    detailPath: "/admin/economy/pools/:id",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      { name: "mode", label: "Mode", type: "select", options: ["WEIGHTED", "ALL"], default: "WEIGHTED", required: true, help: "WEIGHTED picks one entry by weight. ALL grants every active entry." },
      status(),
    ],
    columns: ["name", "mode", "status"],
    searchFields: ["name"],
    significant: true,
  },
  poolEntries: {
    key: "poolEntries",
    label: "Pool entries",
    singular: "Pool entry",
    group: "Economy",
    permission: "economy.manage",
    pk: "id",
    fields: [
      pool("poolId", "Pool", true),
      { name: "label", label: "Label", type: "text", required: true },
      { name: "rewardType", label: "Reward type", type: "select", options: ["CREDITS", "CASH", "XP", "ITEM", "AREA_UNLOCK"], required: true, default: "CREDITS" },
      { name: "amount", label: "Amount", type: "money", default: "0", help: "Credits for CREDITS, RM for CASH, points for XP, quantity for ITEM." },
      { name: "itemId", label: "Item", type: "relation", relation: "items", help: "Required for ITEM rewards." },
      { name: "areaId", label: "Area", type: "relation", relation: "areas", help: "Required for AREA_UNLOCK rewards." },
      { name: "rarity", label: "Rarity", type: "select", options: RARITY, default: "COMMON", required: true },
      { name: "weight", label: "Weight", type: "number", default: 1, required: true, help: "Relative chance. Probability = weight / total active weight." },
      { name: "maxAwards", label: "Max awards", type: "number", help: "Optional global cap. Leave empty for unlimited." },
      { name: "active", label: "Active", type: "boolean", default: true },
      { name: "reveal", label: "Reveal metadata", type: "json", default: {}, help: 'Optional, e.g. {"headline":"Jackpot!","color":"#f59e0b","icon":"💰"}' },
      sort,
    ],
    columns: ["label", "rewardType", "amount", "rarity", "weight", "active"],
    significant: true,
  },
  boxes: {
    key: "boxes",
    label: "Mystery Boxes",
    singular: "Mystery Box",
    group: "Games",
    permission: "games.manage",
    pk: "id",
    detailPath: "/admin/games/boxes/:id",
    fields: [
      slug,
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      { name: "priceCredits", label: "Price (Credits)", type: "credits", required: true },
      pool("rewardPoolId", "Reward pool", true),
      status(),
      { name: "dailyLimitPerUser", label: "Daily limit per user", type: "number" },
      { name: "totalLimit", label: "Total opens limit", type: "number" },
      { name: "xpReward", label: "XP override", type: "number", help: "Leave empty to use the XP rule for box opens." },
      { name: "theme", label: "Theme", type: "json", default: { color: "#7c3aed", accent: "#f59e0b" } },
      sort,
    ],
    columns: ["name", "priceCredits", "status", "dailyLimitPerUser", "sortOrder"],
    searchFields: ["name", "slug"],
    significant: true,
  },
  maps: {
    key: "maps",
    label: "Mystery Maps",
    singular: "Map",
    group: "Games",
    permission: "games.manage",
    pk: "id",
    detailPath: "/admin/games/maps/:id",
    fields: [
      slug,
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      status(),
      { name: "version", label: "Content version", type: "number", default: 1, help: "Stamped on new discoveries so history stays interpretable after edits." },
    ],
    columns: ["name", "slug", "status", "version"],
  },
  areas: {
    key: "areas",
    label: "Map areas",
    singular: "Area",
    group: "Games",
    permission: "games.manage",
    pk: "id",
    detailPath: "/admin/games/areas/:id",
    fields: [
      { name: "mapId", label: "Map", type: "relation", relation: "maps", required: true },
      slug,
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      { name: "icon", label: "Icon", type: "text", default: "🏝️" },
      { name: "color", label: "Color", type: "color", default: "#0ea5e9" },
      { name: "isSpecial", label: "Special Area", type: "boolean", default: false, help: "Special Areas require their requirements to be met before unlocking." },
      { name: "discoveryCostCredits", label: "Discovery cost (Credits)", type: "credits", default: 0 },
      pool("discoveryPoolId", "Discovery pool"),
      pool("unlockRewardPoolId", "Unlock reward pool"),
      { name: "gridCols", label: "Grid columns", type: "number", default: 4 },
      { name: "gridRows", label: "Grid rows", type: "number", default: 3 },
      { name: "posX", label: "Map position X", type: "number", default: 0 },
      { name: "posY", label: "Map position Y", type: "number", default: 0 },
      status(),
      sort,
    ],
    columns: ["name", "isSpecial", "discoveryCostCredits", "status", "sortOrder"],
    searchFields: ["name", "slug"],
    significant: true,
  },
  tiles: {
    key: "tiles",
    label: "Map tiles",
    singular: "Tile",
    group: "Games",
    permission: "games.manage",
    pk: "id",
    fields: [
      { name: "areaId", label: "Area", type: "relation", relation: "areas", required: true },
      { name: "row", label: "Row", type: "number", required: true, default: 0 },
      { name: "col", label: "Column", type: "number", required: true, default: 0 },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "icon", label: "Icon", type: "text", default: "❔" },
      { name: "costCreditsOverride", label: "Cost override (Credits)", type: "credits", help: "Leave empty to use the area cost." },
      pool("discoveryPoolId", "Discovery pool override"),
      status(),
    ],
    columns: ["name", "row", "col", "costCreditsOverride", "status"],
    deletable: true,
    significant: true,
  },
  requirements: {
    key: "requirements",
    label: "Requirements",
    singular: "Requirement",
    group: "Games",
    permission: "games.manage",
    pk: "id",
    fields: [
      { name: "ownerType", label: "Applies to", type: "select", options: ["AREA", "VAULT"], required: true, default: "AREA" },
      { name: "ownerId", label: "Area or Vault", type: "relation", relation: "owners", required: true },
      { name: "type", label: "Type", type: "select", options: ["ITEM", "COLLECTION_COMPLETE", "COLLECTION_PROGRESS", "AREA_UNLOCKED", "AREA_TILES", "XP_LEVEL"], required: true, default: "ITEM" },
      { name: "label", label: "Label shown to players", type: "text", required: true },
      { name: "itemId", label: "Item", type: "relation", relation: "items", help: "For ITEM requirements." },
      { name: "collectionId", label: "Collection", type: "relation", relation: "collections", help: "For collection requirements." },
      { name: "areaId", label: "Area", type: "relation", relation: "areas", help: "For AREA_UNLOCKED and AREA_TILES." },
      { name: "quantity", label: "Quantity / threshold", type: "number", default: 1 },
      { name: "consume", label: "Consume on unlock", type: "boolean", default: false },
      sort,
    ],
    columns: ["label", "ownerType", "type", "quantity", "consume"],
    deletable: true,
    significant: true,
  },
  vaults: {
    key: "vaults",
    label: "Vaults",
    singular: "Vault",
    group: "Games",
    permission: "games.manage",
    pk: "id",
    detailPath: "/admin/games/vaults/:id",
    fields: [
      slug,
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      { name: "icon", label: "Icon", type: "text", default: "🏛️" },
      { name: "mapId", label: "Map", type: "relation", relation: "maps" },
      pool("rewardPoolId", "Reward pool"),
      status(),
      sort,
    ],
    columns: ["name", "status", "sortOrder"],
    significant: true,
  },
  missions: {
    key: "missions",
    label: "Daily missions",
    singular: "Mission",
    group: "Daily",
    permission: "daily.manage",
    pk: "id",
    fields: [
      { name: "key", label: "Key", type: "text", required: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "action", label: "Tracked action", type: "select", options: ["DAILY_LOGIN", "DAILY_SPIN", "OPEN_BOX", "DISCOVER_TILE", "CONVERT_CREDITS", "DAILY_EVENT", "UNLOCK_AREA", "COLLECT_ITEM"], required: true },
      { name: "target", label: "Target count", type: "number", default: 1, required: true },
      { name: "icon", label: "Icon", type: "text", default: "🎯" },
      { name: "active", label: "Active", type: "boolean", default: true },
    ],
    columns: ["title", "action", "target", "active"],
    searchFields: ["title", "key"],
  },
  dailySchedules: {
    key: "dailySchedules",
    label: "Daily schedules",
    singular: "Daily schedule",
    group: "Daily",
    permission: "daily.manage",
    pk: "id",
    detailPath: "/admin/daily/:id",
    fields: [
      { name: "day", label: "Day", type: "date", required: true },
      status("DRAFT"),
      pool("spinPoolId", "Daily Spin pool"),
      { name: "mission1Id", label: "Mission 1", type: "relation", relation: "missions" },
      { name: "mission2Id", label: "Mission 2", type: "relation", relation: "missions" },
      { name: "mission3Id", label: "Mission 3", type: "relation", relation: "missions" },
      pool("missionBonusPoolId", "Mission bonus pool"),
      { name: "eventTitle", label: "Mystery event title", type: "text" },
      { name: "eventDescription", label: "Mystery event description", type: "textarea" },
      { name: "eventIcon", label: "Mystery event icon", type: "text" },
      pool("eventPoolId", "Mystery event pool"),
      { name: "eventCostCredits", label: "Mystery event cost (Credits)", type: "credits", default: 0 },
      { name: "freeDiscoveries", label: "Free map discoveries", type: "number", help: "Leave empty to use the default." },
      { name: "teaserTitle", label: "Tomorrow teaser title", type: "text" },
      { name: "teaserText", label: "Tomorrow teaser text", type: "textarea" },
      { name: "notes", label: "Internal notes", type: "textarea" },
    ],
    columns: ["day", "status", "eventTitle", "teaserTitle"],
    deletable: true,
  },
  streakMilestones: {
    key: "streakMilestones",
    label: "Streak milestones",
    singular: "Streak milestone",
    group: "Daily",
    permission: "daily.manage",
    pk: "id",
    fields: [
      { name: "days", label: "Streak days", type: "number", required: true },
      { name: "title", label: "Title", type: "text", required: true },
      pool("rewardPoolId", "Reward pool"),
      { name: "active", label: "Active", type: "boolean", default: true },
    ],
    columns: ["days", "title", "active"],
    significant: true,
  },
  collections: {
    key: "collections",
    label: "Collections",
    singular: "Collection",
    group: "Collections",
    permission: "collections.manage",
    pk: "id",
    detailPath: "/admin/collections/:id",
    fields: [
      slug,
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      { name: "icon", label: "Icon", type: "text", default: "🏝️" },
      { name: "color", label: "Color", type: "color", default: "#6366f1" },
      pool("completionRewardPoolId", "Completion reward pool"),
      status(),
      sort,
    ],
    columns: ["name", "slug", "status", "sortOrder"],
    searchFields: ["name", "slug"],
    significant: true,
  },
  items: {
    key: "items",
    label: "Items",
    singular: "Item",
    group: "Collections",
    permission: "collections.manage",
    pk: "id",
    fields: [
      slug,
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", default: "" },
      { name: "icon", label: "Icon", type: "text", default: "✨" },
      { name: "kind", label: "Kind", type: "select", options: ["COLLECTIBLE", "SPECIAL", "KEY", "FRAGMENT", "COSMETIC"], required: true, default: "COLLECTIBLE" },
      { name: "rarity", label: "Rarity", type: "select", options: RARITY, default: "COMMON", required: true },
      { name: "purpose", label: "Purpose", type: "textarea", required: true, help: "Shown to players: what this item is for." },
      { name: "effect", label: "Effect", type: "text", default: "" },
      { name: "collectionId", label: "Collection", type: "relation", relation: "collections" },
      { name: "assemblesIntoItemId", label: "Assembles into", type: "relation", relation: "items", help: "For fragments: the item they combine into." },
      { name: "fragmentsRequired", label: "Fragments required", type: "number" },
      { name: "autoAssemble", label: "Auto-assemble", type: "boolean", default: false },
      status(),
      sort,
    ],
    columns: ["name", "kind", "rarity", "status"],
    searchFields: ["name", "slug"],
  },
  xpRules: {
    key: "xpRules",
    label: "XP rules",
    singular: "XP rule",
    group: "Progression",
    permission: "progression.manage",
    pk: "source",
    fields: [
      { name: "source", label: "Source key", type: "text", required: true, immutable: true },
      { name: "label", label: "Label", type: "text", required: true },
      { name: "amount", label: "XP amount", type: "number", required: true, default: 0 },
      { name: "active", label: "Active", type: "boolean", default: true },
    ],
    columns: ["label", "source", "amount", "active"],
    significant: true,
  },
  xpLevels: {
    key: "xpLevels",
    label: "XP levels",
    singular: "XP level",
    group: "Progression",
    permission: "progression.manage",
    pk: "level",
    fields: [
      { name: "level", label: "Level", type: "number", required: true, immutable: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "xpRequired", label: "Total XP required", type: "number", required: true },
      pool("rewardPoolId", "Level-up reward pool"),
    ],
    columns: ["level", "title", "xpRequired"],
    significant: true,
  },
  depositLevels: {
    key: "depositLevels",
    label: "Deposit levels",
    singular: "Deposit level",
    group: "Progression",
    permission: "progression.manage",
    pk: "id",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "sortOrder", label: "Order", type: "number", required: true },
      { name: "threshold", label: "Total deposits threshold (RM)", type: "money", required: true },
      { name: "color", label: "Color", type: "color", default: "#64748b" },
      { name: "benefits", label: "Benefits", type: "list", default: [], help: "One benefit per line." },
      { name: "canWithdraw", label: "Can withdraw", type: "boolean", default: true },
      { name: "withdrawalMin", label: "Withdrawal minimum (RM)", type: "money" },
      { name: "withdrawalMaxDaily", label: "Withdrawal daily max (RM)", type: "money" },
    ],
    columns: ["name", "sortOrder", "threshold", "canWithdraw"],
    significant: true,
  },
  achievements: {
    key: "achievements",
    label: "Achievements",
    singular: "Achievement",
    group: "Progression",
    permission: "progression.manage",
    pk: "id",
    fields: [
      { name: "key", label: "Key", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "condition", label: "Condition", type: "select", options: ["BOXES_OPENED", "TILES_DISCOVERED", "AREAS_UNLOCKED", "COLLECTIONS_COMPLETED", "VAULTS_UNLOCKED", "STREAK_DAYS", "XP_LEVEL", "ITEMS_COLLECTED"], required: true },
      { name: "threshold", label: "Threshold", type: "number", required: true },
      { name: "badgeName", label: "Badge name", type: "text", required: true },
      { name: "badgeIcon", label: "Badge icon", type: "text", default: "🏅" },
      pool("rewardPoolId", "Reward pool"),
      { name: "active", label: "Active", type: "boolean", default: true },
    ],
    columns: ["name", "condition", "threshold", "badgeName", "active"],
    searchFields: ["name", "key"],
  },
  referralLevels: {
    key: "referralLevels",
    label: "Referral levels",
    singular: "Referral level",
    group: "Referrals",
    permission: "referrals.manage",
    pk: "level",
    fields: [
      { name: "level", label: "Level", type: "number", required: true, immutable: true, help: "1 = direct referrals, up to 3." },
      { name: "rewardKind", label: "Reward kind", type: "select", options: ["FIXED", "PERCENT"], required: true, default: "FIXED" },
      { name: "value", label: "Value", type: "money", required: true, help: "RM for FIXED, percent of the qualifying deposit for PERCENT." },
      { name: "active", label: "Active", type: "boolean", default: true },
    ],
    columns: ["level", "rewardKind", "value", "active"],
    significant: true,
  },
  templates: {
    key: "templates",
    label: "Notification templates",
    singular: "Template",
    group: "Notifications",
    permission: "notifications.manage",
    pk: "key",
    fields: [
      { name: "key", label: "Key", type: "text", required: true, immutable: true },
      { name: "type", label: "Type", type: "select", options: ["REWARD", "MISSION", "COLLECTION", "REFERRAL", "WALLET", "SYSTEM"], required: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Body", type: "textarea", required: true, help: "Placeholders like {{amount}} are filled in when sent." },
      { name: "active", label: "Active", type: "boolean", default: true },
    ],
    columns: ["key", "type", "title", "active"],
  },
  broadcasts: {
    key: "broadcasts",
    label: "Broadcasts",
    singular: "Broadcast",
    group: "Notifications",
    permission: "notifications.manage",
    pk: "id",
    detailPath: "/admin/notifications/broadcasts/:id",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Message", type: "textarea", required: true },
      { name: "link", label: "Link", type: "text", help: "Optional in-app path, e.g. /app/play/map" },
      { name: "audience", label: "Audience", type: "select", options: ["ALL", "DEPOSITORS", "NON_DEPOSITORS"], default: "ALL", required: true },
      status("DRAFT"),
      { name: "scheduledAt", label: "Send at", type: "datetime", help: "Leave empty to send on the next broadcast run after publishing." },
    ],
    columns: ["title", "audience", "status", "scheduledAt", "sentAt", "recipientCount"],
  },
  contentPages: {
    key: "contentPages",
    label: "Public pages",
    singular: "Page",
    group: "Content",
    permission: "content.manage",
    pk: "id",
    fields: [slug, { name: "title", label: "Title", type: "text", required: true }, { name: "body", label: "Body", type: "textarea", required: true, wide: true, help: "Separate paragraphs with a blank line. Lines starting with - become lists." }, status()],
    columns: ["title", "slug", "status", "updatedAt"],
  },
  faqs: {
    key: "faqs",
    label: "FAQ",
    singular: "FAQ entry",
    group: "Content",
    permission: "content.manage",
    pk: "id",
    fields: [
      { name: "question", label: "Question", type: "text", required: true },
      { name: "answer", label: "Answer", type: "textarea", required: true },
      { name: "category", label: "Category", type: "text", default: "General" },
      sort,
      status(),
    ],
    columns: ["question", "category", "sortOrder", "status"],
    searchFields: ["question"],
    deletable: true,
  },
  helpArticles: {
    key: "helpArticles",
    label: "Help articles",
    singular: "Help article",
    group: "Content",
    permission: "content.manage",
    pk: "id",
    fields: [
      slug,
      { name: "title", label: "Title", type: "text", required: true },
      { name: "summary", label: "Summary", type: "text", default: "" },
      { name: "body", label: "Body", type: "textarea", required: true, wide: true },
      { name: "category", label: "Category", type: "text", default: "General" },
      status(),
    ],
    columns: ["title", "category", "status", "updatedAt"],
    searchFields: ["title"],
    deletable: true,
  },
  banners: {
    key: "banners",
    label: "Banners and announcements",
    singular: "Banner",
    group: "Content",
    permission: "content.manage",
    pk: "id",
    fields: [
      { name: "kind", label: "Kind", type: "select", options: ["BANNER", "ANNOUNCEMENT"], default: "BANNER", required: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "body", label: "Body", type: "textarea", default: "" },
      { name: "link", label: "Link", type: "text" },
      status("DRAFT"),
      { name: "startsAt", label: "Starts", type: "datetime" },
      { name: "endsAt", label: "Ends", type: "datetime" },
    ],
    columns: ["title", "kind", "status", "startsAt", "endsAt"],
    deletable: true,
  },
} satisfies Record<string, ResourceDef>;

export type ResourceKey = keyof typeof RESOURCES;

export function getResourceDef(key: string): ResourceDef | null {
  return (RESOURCES as Record<string, ResourceDef>)[key] ?? null;
}

export function resourceHref(def: ResourceDef, id: string | number) {
  return def.detailPath ? def.detailPath.replace(":id", String(id)) : `/admin/manage/${def.key}/${id}`;
}
