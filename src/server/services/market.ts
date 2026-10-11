import { and, desc, eq, gt, gte, ilike, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventory, items, marketListings, marketSales, profiles } from "@/db/schema";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { formatCredits } from "@/lib/money";
import { getConfig } from "./config";
import { assertWithinSpendLimit, lockPlayer } from "./guards";
import { consumeItem, grantItem, returnItem } from "./inventory";
import { postTransaction } from "./ledger";
import { notify } from "./notifications";

/** LootBox's cut of a sale, rounded down so the seller never loses a fraction of a Credit to rounding. */
export function marketFee(total: number, feePct: number) {
  return Math.floor((total * feePct) / 100);
}

export async function createListing(userId: string, input: { itemId: string; quantity: number; unitPrice: number }) {
  const cfg = await getConfig("market");
  if (input.unitPrice < cfg.minPrice || input.unitPrice > cfg.maxPrice) {
    throw new AppError(`Set a price between ${formatCredits(cfg.minPrice)} and ${formatCredits(cfg.maxPrice)} Credits`);
  }
  return db.transaction(async (tx) => {
    await lockPlayer(tx, userId);
    const [item] = await tx.select().from(items).where(eq(items.id, input.itemId)).limit(1);
    if (!item || item.status !== "PUBLISHED") throw new AppError("This item can't be listed");

    const [{ active }] = await tx
      .select({ active: sql<number>`count(*)::int` })
      .from(marketListings)
      .where(and(eq(marketListings.sellerId, userId), eq(marketListings.status, "ACTIVE")));
    if (active >= cfg.maxActiveListings) {
      throw new AppError(`You can have up to ${cfg.maxActiveListings} active listings. Cancel one to list something new.`, "MARKET_LISTING_LIMIT");
    }

    const [listing] = await tx
      .insert(marketListings)
      .values({ sellerId: userId, itemId: item.id, listedQuantity: input.quantity, quantity: input.quantity, unitPrice: input.unitPrice })
      .returning();
    await consumeItem(tx, userId, item.id, input.quantity, { sourceType: "market_listing", sourceId: listing.id, reason: "Listed on the market" });
    return { listingId: listing.id, itemName: item.name };
  });
}

export async function cancelListing(userId: string, listingId: string) {
  return db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(marketListings)
      .where(and(eq(marketListings.id, listingId), eq(marketListings.sellerId, userId)))
      .for("update");
    if (!listing) throw new AppError("Listing not found", "NOT_FOUND", 404);
    if (listing.status !== "ACTIVE") throw new AppError("This listing has already closed");
    await tx
      .update(marketListings)
      .set({ status: "CANCELLED", quantity: 0, closedAt: new Date(), updatedAt: new Date() })
      .where(eq(marketListings.id, listing.id));
    await returnItem(tx, userId, listing.itemId, listing.quantity, { sourceType: "market_listing", sourceId: listing.id, reason: "Market listing cancelled" });
    return { returned: listing.quantity };
  });
}

export async function buyListing(userId: string, input: { listingId: string; quantity: number; idempotencyKey: string }) {
  const findExisting = async () =>
    (
      await db
        .select()
        .from(marketSales)
        .where(and(eq(marketSales.buyerId, userId), eq(marketSales.idempotencyKey, input.idempotencyKey)))
        .limit(1)
    )[0];
  const existing = await findExisting();
  if (existing) return { saleId: existing.id, quantity: existing.quantity, total: existing.total, replayed: true };

  const { feePct } = await getConfig("market");
  try {
    return await db.transaction(async (tx) => {
      const buyer = await lockPlayer(tx, userId);
      const [listing] = await tx.select().from(marketListings).where(eq(marketListings.id, input.listingId)).for("update");
      if (!listing || listing.status !== "ACTIVE" || listing.quantity === 0) throw new AppError("This listing is no longer available", "MARKET_UNAVAILABLE");
      if (listing.sellerId === userId) throw new AppError("You can't buy your own listing");
      if (input.quantity > listing.quantity) throw new AppError(`Only ${listing.quantity} left in this listing`);

      const [seller] = await tx.select({ status: profiles.status }).from(profiles).where(eq(profiles.id, listing.sellerId)).limit(1);
      if (seller?.status !== "ACTIVE") throw new AppError("This listing is no longer available", "MARKET_UNAVAILABLE");
      const [item] = await tx.select().from(items).where(eq(items.id, listing.itemId)).limit(1);

      const total = listing.unitPrice * input.quantity;
      const fee = marketFee(total, feePct);
      await assertWithinSpendLimit(tx, buyer, BigInt(total));

      const [sale] = await tx
        .insert(marketSales)
        .values({
          listingId: listing.id,
          buyerId: userId,
          sellerId: listing.sellerId,
          itemId: listing.itemId,
          quantity: input.quantity,
          unitPrice: listing.unitPrice,
          total,
          fee,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      const { transactionId } = await postTransaction(tx, {
        type: "MARKET_TRADE",
        userId,
        idempotencyKey: `market:${sale.id}`,
        description: `Market: ${input.quantity} x ${item.name}`,
        sourceType: "market_sale",
        sourceId: sale.id,
        metadata: { listingId: listing.id, sellerId: listing.sellerId, feePct },
        entries: [
          { userId, account: "CREDITS", amount: -BigInt(total) },
          { userId: listing.sellerId, account: "CREDITS", amount: BigInt(total - fee) },
          { account: "SYS_GAME_REVENUE", currency: "CREDITS", amount: BigInt(fee) },
        ],
      });
      await tx.update(marketSales).set({ ledgerTransactionId: transactionId }).where(eq(marketSales.id, sale.id));

      const remaining = listing.quantity - input.quantity;
      await tx
        .update(marketListings)
        .set({ quantity: remaining, updatedAt: new Date(), ...(remaining === 0 ? { status: "SOLD" as const, closedAt: new Date() } : {}) })
        .where(eq(marketListings.id, listing.id));

      await grantItem(tx, userId, listing.itemId, input.quantity, { sourceType: "market_sale", sourceId: sale.id, reason: "Bought on the market", skipMission: true });
      await notify(
        tx,
        listing.sellerId,
        "WALLET",
        `${item.icon} You sold ${input.quantity} x ${item.name}`,
        `You received ${formatCredits(total - fee)} Credits after the ${feePct}% market fee.`,
        "/market?tab=listings",
      );
      return { saleId: sale.id, quantity: input.quantity, total, replayed: false };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const replay = await findExisting();
      if (replay) return { saleId: replay.id, quantity: replay.quantity, total: replay.total, replayed: true };
    }
    throw err;
  }
}

export type MarketListingView = Awaited<ReturnType<typeof getMarketListings>>[number];

/** Active listings from other active players, newest first. */
export async function getMarketListings(userId: string, opts: { q?: string; rarity?: (typeof items.$inferSelect)["rarity"] } = {}) {
  const q = opts.q?.trim();
  return db
    .select({
      id: marketListings.id,
      quantity: marketListings.quantity,
      unitPrice: marketListings.unitPrice,
      createdAt: marketListings.createdAt,
      sellerName: profiles.name,
      item: { id: items.id, name: items.name, icon: items.icon, rarity: items.rarity, kind: items.kind, description: items.description },
    })
    .from(marketListings)
    .innerJoin(items, eq(items.id, marketListings.itemId))
    .innerJoin(profiles, eq(profiles.id, marketListings.sellerId))
    .where(
      and(
        eq(marketListings.status, "ACTIVE"),
        gt(marketListings.quantity, 0),
        ne(marketListings.sellerId, userId),
        eq(profiles.status, "ACTIVE"),
        q ? ilike(items.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
        opts.rarity ? eq(items.rarity, opts.rarity) : undefined,
      ),
    )
    .orderBy(desc(marketListings.createdAt))
    .limit(100);
}

/** Headline numbers for the Market: open listings from other players, distinct sellers and listings added in the last 24 hours. */
export async function getMarketStats(userId: string) {
  const since = new Date(Date.now() - 86_400_000);
  const [row] = await db
    .select({
      listings: sql<number>`count(*)::int`,
      sellers: sql<number>`count(distinct ${marketListings.sellerId})::int`,
      fresh: sql<number>`count(*) filter (where ${gte(marketListings.createdAt, since)})::int`,
    })
    .from(marketListings)
    .innerJoin(profiles, eq(profiles.id, marketListings.sellerId))
    .where(and(eq(marketListings.status, "ACTIVE"), gt(marketListings.quantity, 0), ne(marketListings.sellerId, userId), eq(profiles.status, "ACTIVE")));
  return { listings: row?.listings ?? 0, sellers: row?.sellers ?? 0, fresh: row?.fresh ?? 0 };
}

export async function getMyListings(userId: string) {
  return db
    .select({
      id: marketListings.id,
      quantity: marketListings.quantity,
      listedQuantity: marketListings.listedQuantity,
      unitPrice: marketListings.unitPrice,
      createdAt: marketListings.createdAt,
      item: { id: items.id, name: items.name, icon: items.icon, rarity: items.rarity },
    })
    .from(marketListings)
    .innerJoin(items, eq(items.id, marketListings.itemId))
    .where(and(eq(marketListings.sellerId, userId), eq(marketListings.status, "ACTIVE")))
    .orderBy(desc(marketListings.createdAt));
}

/** Items the player owns and can list. */
export async function getSellableItems(userId: string) {
  return db
    .select({
      id: items.id,
      name: items.name,
      icon: items.icon,
      rarity: items.rarity,
      kind: items.kind,
      quantity: inventory.quantity,
    })
    .from(inventory)
    .innerJoin(items, eq(items.id, inventory.itemId))
    .where(and(eq(inventory.userId, userId), gt(inventory.quantity, 0), eq(items.status, "PUBLISHED")))
    .orderBy(items.sortOrder, items.name);
}
