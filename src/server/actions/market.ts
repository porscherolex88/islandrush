"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userAction } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { buyListing, cancelListing, createListing } from "@/server/services/market";
import { assertPlayable, gameRateLimit } from "./guard";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError("Invalid request");
  return r.data;
}

const quantity = z.number().int().min(1).max(10_000);

export async function createListingAction(input: { itemId: string; quantity: number; unitPrice: number }) {
  return userAction(async (user) => {
    const data = parse(z.object({ itemId: z.string().uuid(), quantity, unitPrice: z.number().int().min(1) }), input);
    await assertPlayable(user, "market");
    await gameRateLimit(user.id);
    const result = await createListing(user.id, data);
    revalidatePath("/app", "layout");
    return result;
  });
}

export async function cancelListingAction(listingId: string) {
  return userAction(async (user) => {
    const id = parse(z.string().uuid(), listingId);
    await assertPlayable(user);
    const result = await cancelListing(user.id, id);
    revalidatePath("/app", "layout");
    return result;
  });
}

export async function buyListingAction(input: { listingId: string; quantity: number; idempotencyKey: string }) {
  return userAction(async (user) => {
    const data = parse(z.object({ listingId: z.string().uuid(), quantity, idempotencyKey: z.string().min(8).max(100) }), input);
    await assertPlayable(user, "market");
    await gameRateLimit(user.id);
    const result = await buyListing(user.id, data);
    revalidatePath("/app", "layout");
    return result;
  });
}
