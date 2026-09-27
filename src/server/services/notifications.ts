import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { notifications, profiles } from "@/db/schema";

export type NotificationType = (typeof notifications.$inferInsert)["type"];

const PREF_FOR_TYPE: Partial<Record<NotificationType, "rewards" | "missions" | "referrals" | "system">> = {
  REWARD: "rewards",
  COLLECTION: "rewards",
  MISSION: "missions",
  REFERRAL: "referrals",
};

/** Creates an in-app notification, honouring the user's notification preferences (wallet/system always delivered). */
export async function notify(
  tx: DbOrTx,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
) {
  const pref = PREF_FOR_TYPE[type];
  if (pref) {
    const [p] = await tx
      .select({ prefs: profiles.notificationPrefs })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (p && p.prefs && p.prefs[pref] === false) return;
  }
  await tx.insert(notifications).values({ userId, type, title, body, link });
}

export async function listNotifications(userId: string, limit = 50, offset = 0) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function unreadCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markRead(userId: string, id?: string) {
  const where = id
    ? and(eq(notifications.userId, userId), eq(notifications.id, id))
    : and(eq(notifications.userId, userId), isNull(notifications.readAt));
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}
