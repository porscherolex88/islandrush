import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportTickets } from "@/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import { notify } from "./notifications";

type Actor = { id: string; role: string };
export type TicketStatus = (typeof supportTickets.$inferSelect)["status"];
export type TicketPriority = (typeof supportTickets.$inferSelect)["priority"];

export async function createTicket(userId: string, input: { subject: string; category: string; body: string }) {
  return db.transaction(async (tx) => {
    const [ticket] = await tx.insert(supportTickets).values({ userId, subject: input.subject, category: input.category }).returning();
    await tx.insert(supportMessages).values({ ticketId: ticket.id, authorId: userId, body: input.body });
    return ticket;
  });
}

export async function userTickets(userId: string) {
  return db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.lastMessageAt));
}

export async function ticketThread(ticketId: string, opts: { includeInternal: boolean }) {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw new NotFoundError("Ticket not found");
  const messages = await db
    .select()
    .from(supportMessages)
    .where(opts.includeInternal ? eq(supportMessages.ticketId, ticketId) : and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.isInternal, false)))
    .orderBy(asc(supportMessages.createdAt));
  return { ticket, messages };
}

export async function userReply(userId: string, ticketId: string, body: string) {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId))).limit(1);
    if (!t) throw new NotFoundError("Ticket not found");
    if (t.status === "CLOSED") throw new AppError("This ticket is closed. Please open a new one.");
    await tx.insert(supportMessages).values({ ticketId, authorId: userId, body });
    await tx.update(supportTickets).set({ status: "OPEN", lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
  });
}

export async function staffReply(actor: Actor, ticketId: string, body: string, internal: boolean) {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!t) throw new NotFoundError("Ticket not found");
    await tx.insert(supportMessages).values({ ticketId, authorId: actor.id, body, isInternal: internal, fromStaff: true });
    await tx
      .update(supportTickets)
      .set({ lastMessageAt: new Date(), updatedAt: new Date(), status: internal ? t.status : "PENDING", assignedToId: t.assignedToId ?? actor.id })
      .where(eq(supportTickets.id, ticketId));
    if (!internal) await notify(tx, t.userId, "SYSTEM", "Support replied", `New reply on "${t.subject}"`, `/app/account/support/${t.id}`);
  });
}

export async function updateTicket(
  actor: Actor,
  ticketIds: string[],
  patch: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null; tags?: string[]; resolution?: string | null },
) {
  await db.transaction(async (tx) => {
    for (const id of ticketIds) {
      const [t] = await tx.select().from(supportTickets).where(eq(supportTickets.id, id)).for("update");
      if (!t) continue;
      await tx.update(supportTickets).set({ ...patch, updatedAt: new Date() }).where(eq(supportTickets.id, id));
      await audit(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "support.update",
        entityType: "support_ticket",
        entityId: id,
        before: { status: t.status, priority: t.priority, assignedToId: t.assignedToId, tags: t.tags },
        after: patch,
      });
    }
  });
}
