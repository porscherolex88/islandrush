import "server-only";
import { cache } from "react";
import { getBalances } from "@/server/services/ledger";
import { unreadCount } from "@/server/services/notifications";

/** Balances and unread count for the Home header, deduplicated per request. */
export const getHeaderData = cache(async (userId: string) => {
  const [balances, unread] = await Promise.all([getBalances(userId), unreadCount(userId)]);
  return { balances, unread };
});
