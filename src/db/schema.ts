import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 20, scale: 2 });
const credits = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
const id = () => uuid("id").primaryKey().defaultRandom();

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const roleEnum = pgEnum("role", ["USER", "SUPPORT", "FINANCE", "GAME_ADMIN", "SUPER_ADMIN"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED"]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "UNVERIFIED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "CASH",
  "CREDITS",
  "PENDING_REWARDS",
  "WITHDRAWABLE",
  "WITHDRAWAL_PENDING",
  "SYS_DEPOSIT_CLEARING",
  "SYS_CONVERSION",
  "SYS_CREDIT_ISSUANCE",
  "SYS_GAME_REVENUE",
  "SYS_REWARD_EXPENSE",
  "SYS_REFERRAL_EXPENSE",
  "SYS_PAYOUT",
  "SYS_ADJUSTMENT",
]);
export const currencyEnum = pgEnum("currency", ["MYR", "CREDITS"]);
export const ledgerTxTypeEnum = pgEnum("ledger_tx_type", [
  "DEPOSIT",
  "DEPOSIT_REVERSAL",
  "CONVERSION",
  "GAME_SPEND",
  "GAME_REWARD_CREDITS",
  "CASH_REWARD",
  "REFERRAL_REWARD",
  "SETTLEMENT",
  "REWARD_REVERSAL",
  "WITHDRAWAL_REQUEST",
  "WITHDRAWAL_COMPLETE",
  "WITHDRAWAL_RETURN",
  "ADJUSTMENT",
  "MARKET_TRADE",
]);
export const rewardSourceEnum = pgEnum("reward_source", [
  "GAME_REWARD",
  "REFERRAL_L1",
  "REFERRAL_L2",
  "REFERRAL_L3",
  "ADJUSTMENT",
]);
export const depositStatusEnum = pgEnum("deposit_status", ["PENDING", "APPROVED", "REJECTED", "REVERSED"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "PENDING",
  "REVIEW",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);
export const cashRewardStatusEnum = pgEnum("cash_reward_status", ["PENDING", "HELD", "SETTLED", "REVERSED"]);
export const rarityEnum = pgEnum("rarity", ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]);
export const itemKindEnum = pgEnum("item_kind", ["COLLECTIBLE", "SPECIAL", "KEY", "FRAGMENT", "COSMETIC", "LOOT"]);
export const rewardTypeEnum = pgEnum("reward_type", ["CREDITS", "CASH", "ITEM", "AREA_UNLOCK", "FREE_UNLOCK"]);
export const poolModeEnum = pgEnum("pool_mode", ["WEIGHTED", "ALL"]);
export const contentStatusEnum = pgEnum("content_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const requirementTypeEnum = pgEnum("requirement_type", [
  "ITEM",
  "COLLECTION_COMPLETE",
  "COLLECTION_PROGRESS",
  "AREA_UNLOCKED",
  "AREA_TILES",
]);
export const requirementOwnerEnum = pgEnum("requirement_owner", ["AREA", "VAULT"]);
export const missionActionEnum = pgEnum("mission_action", [
  "DAILY_LOGIN",
  "DAILY_SPIN",
  "OPEN_BOX",
  "DISCOVER_TILE",
  "CONVERT_CREDITS",
  "UNLOCK_AREA",
  "COLLECT_ITEM",
]);
export const achievementConditionEnum = pgEnum("achievement_condition", [
  "BOXES_OPENED",
  "TILES_DISCOVERED",
  "AREAS_UNLOCKED",
  "COLLECTIONS_COMPLETED",
  "VAULTS_UNLOCKED",
  "STREAK_DAYS",
  "ITEMS_COLLECTED",
]);
export const riskTypeEnum = pgEnum("risk_type", [
  "SELF_REFERRAL",
  "DUPLICATE_ACCOUNT",
  "PAYMENT_METHOD_MATCH",
  "DEVICE_MATCH",
  "IP_MATCH",
  "RAPID_SIGNUP",
  "REFERRAL_VELOCITY",
  "SUSPICIOUS_DEPOSIT",
  "UNUSUAL_REWARD",
  "UNUSUAL_WITHDRAWAL",
  "MANUAL",
]);
export const riskSeverityEnum = pgEnum("risk_severity", ["LOW", "MEDIUM", "HIGH"]);
export const riskStatusEnum = pgEnum("risk_status", ["OPEN", "IN_REVIEW", "CLEARED", "CONFIRMED"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["LOW", "NORMAL", "HIGH", "URGENT"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "REWARD",
  "MISSION",
  "COLLECTION",
  "REFERRAL",
  "WALLET",
  "SYSTEM",
]);
export const jobStatusEnum = pgEnum("job_status", ["RUNNING", "SUCCESS", "FAILED"]);
export const bannerKindEnum = pgEnum("banner_kind", ["BANNER", "ANNOUNCEMENT"]);
export const prizeKindEnum = pgEnum("prize_kind", ["PHYSICAL", "CREDITS", "CASH"]);
export const prizeClaimStatusEnum = pgEnum("prize_claim_status", [
  "UNLOCKED",
  "CLAIM_PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "FULFILLING",
  "FULFILLED",
  "REJECTED",
]);
export const unlockOutcomeEnum = pgEnum("unlock_outcome", ["PRIZE", "ALTERNATIVE"]);
export const gameEventTypeEnum = pgEnum("game_event_type", [
  "MYSTERY_BOX_PURCHASE",
  "MYSTERY_BOX_REWARD",
  "LOOT_REWARD",
  "MAP_UNLOCK",
  "MAP_CHECKPOINT_UNLOCK",
  "MAP_COMPLETION",
  "BIG_MYSTERY_BOX_OPEN",
  "PUZZLE_PIECE_REWARD",
  "PUZZLE_COMPLETED",
  "PRIZE_UNLOCK_ATTEMPT",
  "PRIZE_UNLOCK_RESULT",
  "ALTERNATIVE_REWARD",
  "PRIZE_CLAIM",
  "PRIZE_CLAIM_STATUS",
]);

/* ----------------------------------------------------------------------------
 * Identity & access
 * ------------------------------------------------------------------------- */

/** Application profile. `id` is the Neon Auth (Better Auth) user id. */
export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    role: roleEnum("role").notNull().default("USER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    suspendedReason: text("suspended_reason"),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("UNVERIFIED"),
    verificationRequired: boolean("verification_required").notNull().default(false),
    verificationNote: text("verification_note"),
    referralCode: text("referral_code").notNull(),
    referredById: text("referred_by_id"),
    rewardsOnHold: boolean("rewards_on_hold").notNull().default(false),
    depositLevelId: uuid("deposit_level_id"),
    totalDeposits: money("total_deposits").notNull().default("0"),
    notificationPrefs: jsonb("notification_prefs")
      .$type<{ rewards: boolean; missions: boolean; referrals: boolean; system: boolean }>()
      .notNull()
      .default({ rewards: true, missions: true, referrals: true, system: true }),
    playLimits: jsonb("play_limits")
      .$type<{ dailyCreditLimit: number | null; selfExcludedUntil: string | null }>()
      .notNull()
      .default({ dailyCreditLimit: null, selfExcludedUntil: null }),
    signupIp: text("signup_ip"),
    signupDeviceId: text("signup_device_id"),
    lastSeenAt: ts("last_seen_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("profiles_email_uq").on(t.email),
    uniqueIndex("profiles_referral_code_uq").on(t.referralCode),
    index("profiles_referred_by_idx").on(t.referredById),
    index("profiles_role_idx").on(t.role),
    index("profiles_created_idx").on(t.createdAt),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: roleEnum("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);

export const loginEvents = pgTable(
  "login_events",
  {
    id: id(),
    userId: text("user_id").references(() => profiles.id),
    email: text("email"),
    success: boolean("success").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    deviceId: text("device_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_events_user_idx").on(t.userId, t.createdAt),
    index("login_events_ip_idx").on(t.ip),
    index("login_events_device_idx").on(t.deviceId),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

/* ----------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------- */

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: text("updated_by"),
  updatedAt: updatedAt(),
});

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  updatedBy: text("updated_by"),
  updatedAt: updatedAt(),
});

/* ----------------------------------------------------------------------------
 * Ledger
 * ------------------------------------------------------------------------- */

export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: id(),
    userId: text("user_id").references(() => profiles.id),
    type: accountTypeEnum("type").notNull(),
    currency: currencyEnum("currency").notNull(),
    balance: numeric("balance", { precision: 20, scale: 2 }).notNull().default("0"),
    allowNegative: boolean("allow_negative").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("fa_user_type_uq").on(t.userId, t.type).where(sql`${t.userId} is not null`),
    uniqueIndex("fa_system_type_currency_uq").on(t.type, t.currency).where(sql`${t.userId} is null`),
    check("fa_non_negative", sql`${t.allowNegative} or ${t.balance} >= 0`),
  ],
);

export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: id(),
    type: ledgerTxTypeEnum("type").notNull(),
    userId: text("user_id").references(() => profiles.id),
    idempotencyKey: text("idempotency_key").notNull(),
    description: text("description").notNull(),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    rewardSource: rewardSourceEnum("reward_source"),
    reversesId: uuid("reverses_id"),
    createdBy: text("created_by"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ltx_idem_uq").on(t.idempotencyKey),
    index("ltx_user_idx").on(t.userId, t.createdAt),
    index("ltx_source_idx").on(t.sourceType, t.sourceId),
    index("ltx_type_idx").on(t.type, t.createdAt),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccounts.id),
    userId: text("user_id"),
    accountType: accountTypeEnum("account_type").notNull(),
    currency: currencyEnum("currency").notNull(),
    amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
    /** Running balance for user accounts. Null for system accounts, whose balance is derived by SUM. */
    balanceAfter: numeric("balance_after", { precision: 20, scale: 2 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("le_tx_idx").on(t.transactionId),
    index("le_account_idx").on(t.accountId, t.id),
    index("le_user_idx").on(t.userId, t.createdAt),
    check("le_nonzero", sql`${t.amount} <> 0`),
  ],
);

/* ----------------------------------------------------------------------------
 * Files, deposits, withdrawals, conversions, cash rewards
 * ------------------------------------------------------------------------- */

export const uploadedFiles = pgTable("uploaded_files", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id),
  purpose: text("purpose").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const paymentAccounts = pgTable("payment_accounts", {
  id: id(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  instructions: text("instructions").notNull().default(""),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const deposits = pgTable(
  "deposits",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    amount: money("amount").notNull(),
    method: text("method").notNull().default("BANK_TRANSFER"),
    paymentAccountId: uuid("payment_account_id").references(() => paymentAccounts.id),
    reference: text("reference").notNull(),
    payerName: text("payer_name").notNull(),
    userNote: text("user_note"),
    proofFileId: uuid("proof_file_id").references(() => uploadedFiles.id),
    status: depositStatusEnum("status").notNull().default("PENDING"),
    reviewerId: text("reviewer_id").references(() => profiles.id),
    reviewedAt: ts("reviewed_at"),
    reviewNote: text("review_note"),
    internalNote: text("internal_note"),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("deposits_user_idem_uq").on(t.userId, t.idempotencyKey),
    index("deposits_status_idx").on(t.status, t.createdAt),
    index("deposits_user_idx").on(t.userId, t.createdAt),
    index("deposits_reference_idx").on(t.reference),
    check("deposits_amount_pos", sql`${t.amount} > 0`),
  ],
);

export const withdrawalAccounts = pgTable(
  "withdrawal_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name").notNull(),
    accountNumber: text("account_number").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("wa_user_idx").on(t.userId), index("wa_number_idx").on(t.accountNumber)],
);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    withdrawalAccountId: uuid("withdrawal_account_id")
      .notNull()
      .references(() => withdrawalAccounts.id),
    amount: money("amount").notNull(),
    status: withdrawalStatusEnum("status").notNull().default("PENDING"),
    accountSnapshot: jsonb("account_snapshot")
      .$type<{ bankName: string; accountName: string; accountNumber: string }>()
      .notNull(),
    sourceBreakdown: jsonb("source_breakdown").$type<Record<string, string>>().notNull().default({}),
    reviewerId: text("reviewer_id").references(() => profiles.id),
    reviewNote: text("review_note"),
    internalNote: text("internal_note"),
    payoutReference: text("payout_reference"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestTransactionId: uuid("request_transaction_id").references(() => ledgerTransactions.id),
    settleTransactionId: uuid("settle_transaction_id").references(() => ledgerTransactions.id),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("withdrawals_user_idem_uq").on(t.userId, t.idempotencyKey),
    index("withdrawals_status_idx").on(t.status, t.createdAt),
    index("withdrawals_user_idx").on(t.userId, t.createdAt),
    check("withdrawals_amount_pos", sql`${t.amount} > 0`),
  ],
);

export const conversions = pgTable(
  "conversions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    cashAmount: money("cash_amount").notNull(),
    credits: credits("credits").notNull(),
    rateCash: money("rate_cash").notNull(),
    rateCredits: credits("rate_credits").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversions_user_idem_uq").on(t.userId, t.idempotencyKey),
    index("conversions_user_idx").on(t.userId, t.createdAt),
  ],
);

export const cashRewards = pgTable(
  "cash_rewards",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    amount: money("amount").notNull(),
    source: rewardSourceEnum("source").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    status: cashRewardStatusEnum("status").notNull().default("PENDING"),
    refereeId: text("referee_id").references(() => profiles.id),
    referralLevel: integer("referral_level"),
    depositId: uuid("deposit_id").references(() => deposits.id),
    settleAfter: ts("settle_after").notNull(),
    heldReason: text("held_reason"),
    creditTransactionId: uuid("credit_transaction_id").references(() => ledgerTransactions.id),
    settleTransactionId: uuid("settle_transaction_id").references(() => ledgerTransactions.id),
    reverseTransactionId: uuid("reverse_transaction_id").references(() => ledgerTransactions.id),
    settledAt: ts("settled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cr_user_idx").on(t.userId, t.createdAt),
    index("cr_status_idx").on(t.status, t.settleAfter),
    uniqueIndex("cr_referral_uq")
      .on(t.userId, t.depositId, t.referralLevel)
      .where(sql`${t.depositId} is not null`),
  ],
);

/* ----------------------------------------------------------------------------
 * Rewards, items, collections
 * ------------------------------------------------------------------------- */

export const rewardPools = pgTable("reward_pools", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  mode: poolModeEnum("mode").notNull().default("WEIGHTED"),
  status: contentStatusEnum("status").notNull().default("PUBLISHED"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rewardPoolEntries = pgTable(
  "reward_pool_entries",
  {
    id: id(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => rewardPools.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    rewardType: rewardTypeEnum("reward_type").notNull(),
    amount: numeric("amount", { precision: 20, scale: 2 }).notNull().default("0"),
    itemId: uuid("item_id"),
    areaId: uuid("area_id"),
    rarity: rarityEnum("rarity").notNull().default("COMMON"),
    weight: integer("weight").notNull().default(1),
    maxAwards: integer("max_awards"),
    awardedCount: integer("awarded_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    reveal: jsonb("reveal").$type<{ headline?: string; color?: string; icon?: string }>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("rpe_pool_idx").on(t.poolId),
    check("rpe_weight_nonneg", sql`${t.weight} >= 0`),
    check("rpe_awarded_limit", sql`${t.maxAwards} is null or ${t.awardedCount} <= ${t.maxAwards}`),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("🏝️"),
    color: text("color").notNull().default("#6366f1"),
    completionRewardPoolId: uuid("completion_reward_pool_id").references(() => rewardPools.id),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("collections_slug_uq").on(t.slug)],
);

export const items = pgTable(
  "items",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("✨"),
    kind: itemKindEnum("kind").notNull(),
    rarity: rarityEnum("rarity").notNull().default("COMMON"),
    purpose: text("purpose").notNull(),
    effect: text("effect").notNull().default(""),
    collectionId: uuid("collection_id").references(() => collections.id),
    assemblesIntoItemId: uuid("assembles_into_item_id"),
    fragmentsRequired: integer("fragments_required"),
    autoAssemble: boolean("auto_assemble").notNull().default(false),
    /** For LOOT items: the adventure Map level this Loot counts toward. */
    adventureLevel: integer("adventure_level"),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("items_slug_uq").on(t.slug),
    index("items_collection_idx").on(t.collectionId),
    index("items_kind_idx").on(t.kind),
    index("items_adventure_level_idx").on(t.adventureLevel),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: integer("quantity").notNull().default(0),
    totalAcquired: integer("total_acquired").notNull().default(0),
    firstAcquiredAt: ts("first_acquired_at").notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
    check("inventory_qty_nonneg", sql`${t.quantity} >= 0`),
  ],
);

export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    createdAt: createdAt(),
  },
  (t) => [index("ie_user_idx").on(t.userId, t.createdAt), index("ie_item_idx").on(t.itemId)],
);

export const collectionCompletions = pgTable(
  "collection_completions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id),
    rewards: jsonb("rewards").$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cc_user_collection_uq").on(t.userId, t.collectionId)],
);

/* ----------------------------------------------------------------------------
 * Market (player-to-player item trading for Credits)
 * ------------------------------------------------------------------------- */

export const marketListingStatusEnum = pgEnum("market_listing_status", ["ACTIVE", "SOLD", "CANCELLED"]);

/** Listed items are held in escrow: they leave the seller's inventory until sold or cancelled. */
export const marketListings = pgTable(
  "market_listings",
  {
    id: id(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => profiles.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    listedQuantity: integer("listed_quantity").notNull(),
    /** Units still for sale. */
    quantity: integer("quantity").notNull(),
    unitPrice: credits("unit_price").notNull(),
    status: marketListingStatusEnum("status").notNull().default("ACTIVE"),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ml_status_idx").on(t.status, t.createdAt),
    index("ml_seller_idx").on(t.sellerId, t.status),
    index("ml_item_idx").on(t.itemId, t.status),
    check("ml_qty_valid", sql`${t.quantity} >= 0 AND ${t.quantity} <= ${t.listedQuantity}`),
    check("ml_price_positive", sql`${t.unitPrice} > 0`),
  ],
);

export const marketSales = pgTable(
  "market_sales",
  {
    id: id(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => marketListings.id),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => profiles.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => profiles.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    quantity: integer("quantity").notNull(),
    unitPrice: credits("unit_price").notNull(),
    total: credits("total").notNull(),
    fee: credits("fee").notNull(),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ms_buyer_idem_uq").on(t.buyerId, t.idempotencyKey),
    index("ms_listing_idx").on(t.listingId),
    index("ms_seller_idx").on(t.sellerId, t.createdAt),
  ],
);

/* ----------------------------------------------------------------------------
 * Mystery Box
 * ------------------------------------------------------------------------- */

export const mysteryBoxes = pgTable(
  "mystery_boxes",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCredits: credits("price_credits").notNull(),
    rewardPoolId: uuid("reward_pool_id")
      .notNull()
      .references(() => rewardPools.id),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    dailyLimitPerUser: integer("daily_limit_per_user"),
    totalLimit: integer("total_limit"),
    theme: jsonb("theme").$type<{ color: string; accent: string }>().notNull().default({ color: "#7c3aed", accent: "#f59e0b" }),
    /** Adventure level (1-10). Boxes without a level are legacy and hidden from the adventure. */
    level: integer("level"),
    /** Map level that must be completed before this box can be opened. Null = available immediately. */
    requiresMapLevel: integer("requires_map_level"),
    /** Guaranteed Loot drop granted on every open, in addition to the reward pool. */
    lootPoolId: uuid("loot_pool_id").references(() => rewardPools.id),
    artwork: text("artwork"),
    /** Plays of this box that fill a player's jackpot meter. 0 turns the jackpot off. */
    jackpotPlays: integer("jackpot_plays").notNull().default(50),
    /** Free spins the jackpot gives when the meter is full. */
    jackpotSpins: integer("jackpot_spins").notNull().default(10),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("mystery_boxes_slug_uq").on(t.slug),
    uniqueIndex("mystery_boxes_level_uq").on(t.level).where(sql`${t.level} is not null`),
    check("mb_price_pos", sql`${t.priceCredits} > 0`),
    check("mb_level_range", sql`${t.level} is null or ${t.level} between 1 and 10`),
  ],
);

export const mysteryBoxPlays = pgTable(
  "mystery_box_plays",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    boxId: uuid("box_id")
      .notNull()
      .references(() => mysteryBoxes.id),
    selectedIndex: integer("selected_index").notNull(),
    creditsSpent: credits("credits_spent").notNull(),
    poolEntryId: uuid("pool_entry_id").references(() => rewardPoolEntries.id),
    reward: jsonb("reward").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    appDay: date("app_day").notNull(),
    level: integer("level"),
    loot: jsonb("loot").$type<Record<string, unknown>[]>().notNull().default([]),
    /** Box configuration at the moment of opening, so later edits never change history. */
    configSnapshot: jsonb("config_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    /** Set on the free spins a jackpot gives. These never count toward the jackpot meter or limits. */
    jackpotId: uuid("jackpot_id"),
    /** Order of this spin within its jackpot. */
    jackpotSpin: integer("jackpot_spin"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("mbp_user_idem_uq").on(t.userId, t.idempotencyKey),
    index("mbp_jackpot_idx").on(t.jackpotId),
    index("mbp_user_idx").on(t.userId, t.createdAt),
    index("mbp_box_idx").on(t.boxId, t.createdAt),
    check("mbp_index_range", sql`${t.selectedIndex} between 0 and 8`),
  ],
);

/** A jackpot a player hit on a box: the meter filled up and the box spun for free several times. */
export const boxJackpots = pgTable(
  "box_jackpots",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    boxId: uuid("box_id")
      .notNull()
      .references(() => mysteryBoxes.id),
    /** The play that filled the meter. */
    triggerPlayId: uuid("trigger_play_id").notNull(),
    /** The player's total plays of this box when it hit, so the meter starts again from here. */
    playsAt: integer("plays_at").notNull(),
    spins: integer("spins").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bj_trigger_uq").on(t.triggerPlayId), index("bj_user_box_idx").on(t.userId, t.boxId)],
);

/** A Free unlock won in a box: one more play of that same box without paying Credits. */
export const freeBoxPlays = pgTable(
  "free_box_plays",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    boxId: uuid("box_id")
      .notNull()
      .references(() => mysteryBoxes.id),
    /** The play that won it. */
    sourcePlayId: uuid("source_play_id").notNull(),
    /** The play that used it, once used. */
    usedByPlayId: uuid("used_by_play_id"),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("fbp_source_uq").on(t.sourcePlayId), uniqueIndex("fbp_used_by_uq").on(t.usedByPlayId), index("fbp_user_box_idx").on(t.userId, t.boxId)],
);

/* ----------------------------------------------------------------------------
 * Mystery Map, Special Areas, Vault
 * ------------------------------------------------------------------------- */

export const maps = pgTable(
  "maps",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    version: integer("version").notNull().default(1),
    /** Adventure level (1-10). Maps without a level are the legacy tile island. */
    level: integer("level"),
    /** Loot (for this map level) that must be collected before the map can be unlocked. */
    lootRequired: integer("loot_required").notNull().default(0),
    artwork: text("artwork"),
    color: text("color").notNull().default("#0ea5e9"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("maps_slug_uq").on(t.slug),
    uniqueIndex("maps_level_uq").on(t.level).where(sql`${t.level} is not null`),
    check("maps_level_range", sql`${t.level} is null or ${t.level} between 1 and 10`),
    check("maps_loot_nonneg", sql`${t.lootRequired} >= 0`),
  ],
);

export const mapAreas = pgTable(
  "map_areas",
  {
    id: id(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("🏝️"),
    color: text("color").notNull().default("#0ea5e9"),
    isSpecial: boolean("is_special").notNull().default(false),
    discoveryCostCredits: credits("discovery_cost_credits").notNull().default(0),
    discoveryPoolId: uuid("discovery_pool_id").references(() => rewardPools.id),
    unlockRewardPoolId: uuid("unlock_reward_pool_id").references(() => rewardPools.id),
    gridCols: integer("grid_cols").notNull().default(4),
    gridRows: integer("grid_rows").notNull().default(3),
    posX: integer("pos_x").notNull().default(0),
    posY: integer("pos_y").notNull().default(0),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("map_areas_slug_uq").on(t.mapId, t.slug), index("map_areas_map_idx").on(t.mapId)],
);

export const mapTiles = pgTable(
  "map_tiles",
  {
    id: id(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => mapAreas.id),
    row: integer("row").notNull(),
    col: integer("col").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("❔"),
    costCreditsOverride: credits("cost_credits_override"),
    discoveryPoolId: uuid("discovery_pool_id").references(() => rewardPools.id),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("map_tiles_pos_uq").on(t.areaId, t.row, t.col), index("map_tiles_area_idx").on(t.areaId)],
);

export const tileDiscoveries = pgTable(
  "tile_discoveries",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    tileId: uuid("tile_id")
      .notNull()
      .references(() => mapTiles.id),
    areaId: uuid("area_id")
      .notNull()
      .references(() => mapAreas.id),
    creditsSpent: credits("credits_spent").notNull().default(0),
    usedFreeDiscovery: boolean("used_free_discovery").notNull().default(false),
    reward: jsonb("reward").$type<Record<string, unknown>>().notNull(),
    poolEntryId: uuid("pool_entry_id").references(() => rewardPoolEntries.id),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    mapVersion: integer("map_version").notNull().default(1),
    appDay: date("app_day").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("td_user_tile_uq").on(t.userId, t.tileId),
    index("td_user_idx").on(t.userId, t.createdAt),
    index("td_user_day_idx").on(t.userId, t.appDay),
  ],
);

export const areaUnlocks = pgTable(
  "area_unlocks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    areaId: uuid("area_id")
      .notNull()
      .references(() => mapAreas.id),
    method: text("method").notNull().default("REQUIREMENTS"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("au_user_area_uq").on(t.userId, t.areaId)],
);

export const requirements = pgTable(
  "requirements",
  {
    id: id(),
    ownerType: requirementOwnerEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    type: requirementTypeEnum("type").notNull(),
    label: text("label").notNull(),
    itemId: uuid("item_id").references(() => items.id),
    collectionId: uuid("collection_id").references(() => collections.id),
    areaId: uuid("area_id").references(() => mapAreas.id),
    quantity: integer("quantity").notNull().default(1),
    consume: boolean("consume").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("requirements_owner_idx").on(t.ownerType, t.ownerId)],
);

export const vaults = pgTable(
  "vaults",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("🏛️"),
    mapId: uuid("map_id").references(() => maps.id),
    rewardPoolId: uuid("reward_pool_id").references(() => rewardPools.id),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("vaults_slug_uq").on(t.slug)],
);

export const vaultUnlocks = pgTable(
  "vault_unlocks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id),
    consumed: jsonb("consumed").$type<unknown[]>().notNull().default([]),
    rewards: jsonb("rewards").$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vu_user_vault_uq").on(t.userId, t.vaultId)],
);

/* ----------------------------------------------------------------------------
 * Adventure: map checkpoints, Big Mystery Boxes, puzzles, prizes
 * ------------------------------------------------------------------------- */

export const mapCheckpoints = pgTable(
  "map_checkpoints",
  {
    id: id(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Lucide landmark key shown on the node, e.g. "tent", "landmark", "castle". */
    landmark: text("landmark").notNull().default("flag"),
    /** Total Loot for this map that must have been collected (milestone, never consumed). */
    lootRequired: integer("loot_required").notNull(),
    isFinal: boolean("is_final").notNull().default(false),
    posX: integer("pos_x").notNull().default(50),
    posY: integer("pos_y").notNull().default(50),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("mcp_map_pos_uq").on(t.mapId, t.position),
    uniqueIndex("mcp_map_final_uq").on(t.mapId).where(sql`${t.isFinal}`),
    check("mcp_loot_nonneg", sql`${t.lootRequired} >= 0`),
    check("mcp_pos_range", sql`${t.posX} between 0 and 100 and ${t.posY} between 0 and 100`),
  ],
);

export const userMapProgress = pgTable(
  "user_map_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id),
    level: integer("level").notNull(),
    lootAtUnlock: integer("loot_at_unlock").notNull(),
    unlockedAt: ts("unlocked_at").notNull().defaultNow(),
    /** First time the map was finished. The next map's unlock is based on this. */
    completedAt: ts("completed_at"),
    /** Maps can be replayed: each round resets the checkpoints and gives another Big Mystery Box. */
    round: integer("round").notNull().default(1),
    /** Loot total the current round counts from. Checkpoint thresholds apply to Loot above it. */
    roundLootBase: integer("round_loot_base").notNull().default(0),
    roundCompletedAt: ts("round_completed_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mapId] }), index("ump_user_idx").on(t.userId)],
);

export const userCheckpoints = pgTable(
  "user_checkpoints",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    checkpointId: uuid("checkpoint_id")
      .notNull()
      .references(() => mapCheckpoints.id),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id),
    lootRequired: integer("loot_required").notNull(),
    lootAtUnlock: integer("loot_at_unlock").notNull(),
    round: integer("round").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("uc_user_cp_round_uq").on(t.userId, t.checkpointId, t.round), index("uc_user_map_idx").on(t.userId, t.mapId)],
);

export const bigMysteryBoxes = pgTable(
  "big_mystery_boxes",
  {
    id: id(),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id),
    name: text("name").notNull().default("Big Mystery Box"),
    description: text("description").notNull().default(""),
    artwork: text("artwork"),
    pieces1Pct: integer("pieces_1_pct").notNull().default(50),
    pieces2Pct: integer("pieces_2_pct").notNull().default(35),
    pieces3Pct: integer("pieces_3_pct").notNull().default(15),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bmb_map_uq").on(t.mapId),
    check("bmb_pct_nonneg", sql`${t.pieces1Pct} >= 0 and ${t.pieces2Pct} >= 0 and ${t.pieces3Pct} >= 0`),
    check("bmb_pct_total", sql`${t.pieces1Pct} + ${t.pieces2Pct} + ${t.pieces3Pct} = 100`),
  ],
);

export const bigBoxOpenings = pgTable(
  "big_box_openings",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    mapId: uuid("map_id")
      .notNull()
      .references(() => maps.id),
    bigBoxId: uuid("big_box_id")
      .notNull()
      .references(() => bigMysteryBoxes.id),
    level: integer("level").notNull(),
    pieces: integer("pieces").notNull(),
    odds: jsonb("odds").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    round: integer("round").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bbo_user_map_round_uq").on(t.userId, t.mapId, t.round), check("bbo_pieces_range", sql`${t.pieces} between 1 and 3`)],
);

export const prizes = pgTable(
  "prizes",
  {
    id: id(),
    level: integer("level").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    image: text("image"),
    kind: prizeKindEnum("kind").notNull().default("PHYSICAL"),
    /** Credits or RM amount for CREDITS / CASH prizes. Unused for PHYSICAL. */
    amount: numeric("amount", { precision: 20, scale: 2 }).notNull().default("0"),
    /** Indicative value for PHYSICAL prizes, shown only where legally appropriate. */
    estimatedValue: money("estimated_value"),
    showEstimatedValue: boolean("show_estimated_value").notNull().default(false),
    /** Null = unlimited. */
    inventoryTotal: integer("inventory_total"),
    inventoryAllocated: integer("inventory_allocated").notNull().default(0),
    requiresVerification: boolean("requires_verification").notNull().default(false),
    claimInstructions: text("claim_instructions").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("prizes_level_idx").on(t.level),
    check("prizes_inventory", sql`${t.inventoryTotal} is null or ${t.inventoryAllocated} <= ${t.inventoryTotal}`),
    check("prizes_allocated_nonneg", sql`${t.inventoryAllocated} >= 0`),
  ],
);

export const puzzles = pgTable(
  "puzzles",
  {
    id: id(),
    level: integer("level").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    image: text("image"),
    piecesRequired: integer("pieces_required").notNull(),
    prizeId: uuid("prize_id")
      .notNull()
      .references(() => prizes.id),
    alternativeRewardType: text("alternative_reward_type").$type<"CREDITS" | "CASH">().notNull().default("CREDITS"),
    alternativeRewardAmount: numeric("alternative_reward_amount", { precision: 20, scale: 2 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("puzzles_level_uq").on(t.level),
    check("puzzles_pieces_pos", sql`${t.piecesRequired} > 0`),
    check("puzzles_alt_type", sql`${t.alternativeRewardType} in ('CREDITS', 'CASH')`),
  ],
);

/** Append-only record of every puzzle piece a player has received. */
export const puzzlePieceEvents = pgTable(
  "puzzle_piece_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    delta: integer("delta").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    level: integer("level"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ppe_source_uq").on(t.sourceType, t.sourceId), index("ppe_user_idx").on(t.userId)],
);

export const userPuzzles = pgTable(
  "user_puzzles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    puzzleId: uuid("puzzle_id")
      .notNull()
      .references(() => puzzles.id),
    level: integer("level").notNull(),
    piecesRequired: integer("pieces_required").notNull(),
    piecesTotalAt: integer("pieces_total_at").notNull(),
    prizeId: uuid("prize_id")
      .notNull()
      .references(() => prizes.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("up_user_puzzle_uq").on(t.userId, t.puzzleId)],
);

/** One final unlock attempt per completed puzzle. The outcome is decided and stored server-side. */
export const prizeUnlockAttempts = pgTable(
  "prize_unlock_attempts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    puzzleId: uuid("puzzle_id")
      .notNull()
      .references(() => puzzles.id),
    userPuzzleId: uuid("user_puzzle_id")
      .notNull()
      .references(() => userPuzzles.id),
    prizeId: uuid("prize_id")
      .notNull()
      .references(() => prizes.id),
    level: integer("level").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    outcome: unlockOutcomeEnum("outcome").notNull(),
    roll: integer("roll").notNull(),
    odds: jsonb("odds").$type<{ prizeUnlockPct: number; alternativePct: number; configUpdatedAt: string | null }>().notNull(),
    alternativeReward: jsonb("alternative_reward").$type<Record<string, unknown> | null>(),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pua_user_puzzle_uq").on(t.userId, t.puzzleId), index("pua_user_idx").on(t.userId, t.createdAt)],
);

export const prizeClaims = pgTable(
  "prize_claims",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    prizeId: uuid("prize_id")
      .notNull()
      .references(() => prizes.id),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => prizeUnlockAttempts.id),
    level: integer("level").notNull(),
    status: prizeClaimStatusEnum("status").notNull().default("UNLOCKED"),
    prizeSnapshot: jsonb("prize_snapshot").$type<Record<string, unknown>>().notNull(),
    contact: jsonb("contact").$type<{ fullName?: string; phone?: string; address?: string; note?: string }>().notNull().default({}),
    reviewerId: text("reviewer_id").references(() => profiles.id),
    reviewNote: text("review_note"),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransactions.id),
    claimedAt: ts("claimed_at"),
    fulfilledAt: ts("fulfilled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pc_attempt_uq").on(t.attemptId), index("pc_status_idx").on(t.status, t.createdAt), index("pc_user_idx").on(t.userId)],
);

/** Append-only audit trail for every reward-producing adventure event. */
export const gameEvents = pgTable(
  "game_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    type: gameEventTypeEnum("type").notNull(),
    actionId: text("action_id").notNull(),
    level: integer("level"),
    refType: text("ref_type"),
    refId: text("ref_id"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ge_type_action_uq").on(t.type, t.actionId),
    index("ge_user_idx").on(t.userId, t.createdAt),
    index("ge_type_idx").on(t.type, t.createdAt),
  ],
);

/* ----------------------------------------------------------------------------
 * Daily systems
 * ------------------------------------------------------------------------- */

export const missionDefinitions = pgTable(
  "mission_definitions",
  {
    id: id(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    action: missionActionEnum("action").notNull(),
    target: integer("target").notNull().default(1),
    icon: text("icon").notNull().default("🎯"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("mission_defs_key_uq").on(t.key), check("md_target_pos", sql`${t.target} > 0`)],
);

/** Calendar-scheduled daily content. Days without a published schedule use `daily_defaults` config. */
export const dailySchedules = pgTable(
  "daily_schedules",
  {
    id: id(),
    day: date("day").notNull(),
    status: contentStatusEnum("status").notNull().default("DRAFT"),
    spinPoolId: uuid("spin_pool_id").references(() => rewardPools.id),
    mission1Id: uuid("mission1_id").references(() => missionDefinitions.id),
    mission2Id: uuid("mission2_id").references(() => missionDefinitions.id),
    mission3Id: uuid("mission3_id").references(() => missionDefinitions.id),
    missionBonusPoolId: uuid("mission_bonus_pool_id").references(() => rewardPools.id),
    freeDiscoveries: integer("free_discoveries"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("daily_schedules_day_uq").on(t.day)],
);

export const dailyLogins = pgTable(
  "daily_logins",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    day: date("day").notNull(),
    streakAfter: integer("streak_after").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dl_user_day_uq").on(t.userId, t.day)],
);

export const dailySpins = pgTable(
  "daily_spins",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    day: date("day").notNull(),
    poolId: uuid("pool_id").references(() => rewardPools.id),
    poolEntryId: uuid("pool_entry_id").references(() => rewardPoolEntries.id),
    reward: jsonb("reward").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ds_user_day_uq").on(t.userId, t.day)],
);

export const missionProgress = pgTable(
  "mission_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    day: date("day").notNull(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missionDefinitions.id),
    progress: integer("progress").notNull().default(0),
    completedAt: ts("completed_at"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.missionId] })],
);

export const missionBonusClaims = pgTable(
  "mission_bonus_claims",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    day: date("day").notNull(),
    rewards: jsonb("rewards").$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("mbc_user_day_uq").on(t.userId, t.day)],
);

export const userStreaks = pgTable("user_streaks", {
  userId: text("user_id")
    .primaryKey()
    .references(() => profiles.id),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  lastClaimDay: date("last_claim_day"),
  runStartDay: date("run_start_day"),
  updatedAt: updatedAt(),
});

export const streakMilestones = pgTable(
  "streak_milestones",
  {
    id: id(),
    days: integer("days").notNull(),
    title: text("title").notNull(),
    rewardPoolId: uuid("reward_pool_id").references(() => rewardPools.id),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("streak_milestones_days_uq").on(t.days)],
);

export const streakMilestoneClaims = pgTable(
  "streak_milestone_claims",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => streakMilestones.id),
    runStartDay: date("run_start_day").notNull(),
    rewards: jsonb("rewards").$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("smc_user_ms_run_uq").on(t.userId, t.milestoneId, t.runStartDay)],
);

/* ----------------------------------------------------------------------------
 * Progression
 * ------------------------------------------------------------------------- */

export const depositLevels = pgTable(
  "deposit_levels",
  {
    id: id(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    threshold: money("threshold").notNull(),
    color: text("color").notNull().default("#64748b"),
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
    canWithdraw: boolean("can_withdraw").notNull().default(true),
    withdrawalMin: money("withdrawal_min"),
    withdrawalMaxDaily: money("withdrawal_max_daily"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("deposit_levels_order_uq").on(t.sortOrder)],
);

export const achievements = pgTable(
  "achievements",
  {
    id: id(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    condition: achievementConditionEnum("condition").notNull(),
    threshold: integer("threshold").notNull(),
    badgeName: text("badge_name").notNull(),
    badgeIcon: text("badge_icon").notNull().default("🏅"),
    rewardPoolId: uuid("reward_pool_id").references(() => rewardPools.id),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("achievements_key_uq").on(t.key)],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ua_user_ach_uq").on(t.userId, t.achievementId)],
);

/* ----------------------------------------------------------------------------
 * Referrals & risk
 * ------------------------------------------------------------------------- */

export const referralLevels = pgTable("referral_levels", {
  level: integer("level").primaryKey(),
  rewardKind: text("reward_kind").$type<"FIXED" | "PERCENT">().notNull().default("FIXED"),
  value: numeric("value", { precision: 20, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: updatedAt(),
});

export const riskFlags = pgTable(
  "risk_flags",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    relatedUserId: text("related_user_id").references(() => profiles.id),
    type: riskTypeEnum("type").notNull(),
    severity: riskSeverityEnum("severity").notNull().default("LOW"),
    status: riskStatusEnum("status").notNull().default("OPEN"),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    assignedToId: text("assigned_to_id").references(() => profiles.id),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("risk_flags_user_idx").on(t.userId),
    index("risk_flags_status_idx").on(t.status, t.createdAt),
  ],
);

export const riskNotes = pgTable("risk_notes", {
  id: id(),
  flagId: uuid("flag_id")
    .notNull()
    .references(() => riskFlags.id),
  authorId: text("author_id")
    .notNull()
    .references(() => profiles.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const userNotes = pgTable(
  "user_notes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    authorId: text("author_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("user_notes_user_idx").on(t.userId)],
);

/* ----------------------------------------------------------------------------
 * Notifications, support, content
 * ------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    readAt: ts("read_at"),
    broadcastId: uuid("broadcast_id"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const notificationTemplates = pgTable("notification_templates", {
  key: text("key").primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: updatedAt(),
});

export const broadcasts = pgTable("broadcasts", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  audience: text("audience").$type<"ALL" | "DEPOSITORS" | "NON_DEPOSITORS">().notNull().default("ALL"),
  status: contentStatusEnum("status").notNull().default("DRAFT"),
  scheduledAt: ts("scheduled_at"),
  sentAt: ts("sent_at"),
  recipientCount: integer("recipient_count").notNull().default(0),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    number: bigserial("number", { mode: "number" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    subject: text("subject").notNull(),
    category: text("category").notNull().default("GENERAL"),
    status: ticketStatusEnum("status").notNull().default("OPEN"),
    priority: ticketPriorityEnum("priority").notNull().default("NORMAL"),
    assignedToId: text("assigned_to_id").references(() => profiles.id),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    resolution: text("resolution"),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tickets_status_idx").on(t.status, t.lastMessageAt),
    index("tickets_user_idx").on(t.userId),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: id(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id),
    authorId: text("author_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    fromStaff: boolean("from_staff").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("support_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const contentPages = pgTable(
  "content_pages",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    updatedBy: text("updated_by"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("content_pages_slug_uq").on(t.slug)],
);

export const faqs = pgTable("faqs", {
  id: id(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").notNull().default("General"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: contentStatusEnum("status").notNull().default("PUBLISHED"),
  updatedAt: updatedAt(),
});

export const helpArticles = pgTable(
  "help_articles",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull(),
    category: text("category").notNull().default("General"),
    status: contentStatusEnum("status").notNull().default("PUBLISHED"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("help_articles_slug_uq").on(t.slug)],
);

export const banners = pgTable("banners", {
  id: id(),
  kind: bannerKindEnum("kind").notNull().default("BANNER"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  link: text("link"),
  status: contentStatusEnum("status").notNull().default("DRAFT"),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  updatedAt: updatedAt(),
});

/* ----------------------------------------------------------------------------
 * Audit & jobs
 * ------------------------------------------------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_actor_idx").on(t.actorId, t.createdAt),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_created_idx").on(t.createdAt),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    job: text("job").notNull(),
    status: jobStatusEnum("status").notNull().default("RUNNING"),
    triggeredBy: text("triggered_by"),
    result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("job_runs_job_idx").on(t.job, t.startedAt)],
);
