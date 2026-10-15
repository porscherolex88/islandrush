"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { userAction } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { markRead } from "@/server/services/notifications";
import {
  requestVerification,
  updateNotificationPrefs,
  updateOwnProfile,
  updatePlayLimits,
} from "@/server/services/profiles";
import { rateLimit } from "@/server/services/rate-limit";
import { createTicket, userReply } from "@/server/services/support";

export async function updateProfileAction(input: { name: string; phone: string }) {
  return userAction(async (user) => {
    const { normalizeMyPhone } = await import("@/lib/phone");
    const name = z.string().trim().min(2, "Enter your name").max(80).safeParse(input.name);
    if (!name.success) throw new AppError(name.error.issues[0]?.message ?? "Enter your name");
    const rawPhone = input.phone.trim();
    let phone: string | null = null;
    if (rawPhone) {
      phone = normalizeMyPhone(rawPhone);
      if (!phone) throw new AppError("Enter a Malaysian phone number, e.g. 012 345 6789");
    } else if (!user.phone) {
      // Phone-first accounts must keep a login phone; legacy email accounts may leave it empty until they add one.
      const { isPhoneAuthEmail } = await import("@/lib/phone");
      if (isPhoneAuthEmail(user.email)) throw new AppError("Add a phone number so you can sign in");
    }
    await updateOwnProfile(user.id, { name: name.data, phone });
    await getAuth().updateUser({ name: name.data }).catch(() => null);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function updateNotificationPrefsAction(prefs: { rewards: boolean; missions: boolean; referrals: boolean; system: boolean }) {
  return userAction(async (user) => {
    const d = z.object({ rewards: z.boolean(), missions: z.boolean(), referrals: z.boolean(), system: z.boolean() }).parse(prefs);
    await updateNotificationPrefs(user.id, d);
    revalidatePath("/account", "layout");
    return null;
  });
}

export async function updatePlayLimitsAction(input: { dailyCreditLimit: number | null; breakDays: number | null }) {
  return userAction(
    async (user) => {
      const d = z
        .object({
          dailyCreditLimit: z.number().int().min(1000, "Daily limits start at 1,000 Credits").max(100_000_000).nullable(),
          breakDays: z.number().int().min(1).max(365).nullable(),
        })
        .safeParse(input);
      if (!d.success) throw new AppError(d.error.issues[0]?.message ?? "Please check the form");
      const current = user.playLimits;
      const selfExcludedUntil = d.data.breakDays
        ? new Date(Date.now() + d.data.breakDays * 86_400_000).toISOString()
        : current.selfExcludedUntil;
      await updatePlayLimits(user.id, { dailyCreditLimit: d.data.dailyCreditLimit, selfExcludedUntil });
      revalidatePath("/", "layout");
      return null;
    },
    { allowSuspended: true },
  );
}

export async function requestVerificationAction() {
  return userAction(async (user) => {
    await requestVerification(user.id);
    revalidatePath("/account", "layout");
    return null;
  });
}

export async function markNotificationsReadAction(id?: string) {
  return userAction(
    async (user) => {
      await markRead(user.id, id ? z.string().uuid().parse(id) : undefined);
      revalidatePath("/", "layout");
      return null;
    },
    { allowSuspended: true },
  );
}

export async function createTicketAction(input: { subject: string; category: string; body: string }) {
  return userAction(
    async (user) => {
      const d = z
        .object({
          subject: z.string().trim().min(4, "Add a short subject").max(120),
          category: z.enum(["GENERAL", "DEPOSIT", "WITHDRAWAL", "GAMES", "ACCOUNT", "REFERRALS"]),
          body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
        })
        .safeParse(input);
      if (!d.success) throw new AppError(d.error.issues[0]?.message ?? "Please check the form");
      await rateLimit(`ticket:${user.id}`, 5, 3600);
      const t = await createTicket(user.id, d.data);
      revalidatePath("/account/support");
      return { id: t.id };
    },
    { allowSuspended: true },
  );
}

export async function replyTicketAction(ticketId: string, body: string) {
  return userAction(
    async (user) => {
      const text = z.string().trim().min(1, "Write a message").max(4000).safeParse(body);
      if (!text.success) throw new AppError(text.error.issues[0]?.message ?? "Write a message");
      await rateLimit(`ticket-reply:${user.id}`, 30, 3600);
      await userReply(user.id, z.string().uuid().parse(ticketId), text.data);
      revalidatePath(`/account/support/${ticketId}`);
      return null;
    },
    { allowSuspended: true },
  );
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string; revokeOthers: boolean }) {
  return userAction(
    async (user) => {
      if (input.newPassword.length < 8) throw new AppError("Use at least 8 characters for your new password");
      if (input.newPassword === input.currentPassword) throw new AppError("Choose a password you haven't used here");
      await rateLimit(`pw:${user.id}`, 5, 900);
      const { error } = await getAuth().changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: input.revokeOthers,
      });
      if (error) throw new AppError(error.message?.toLowerCase().includes("password") ? "Your current password is incorrect" : "Could not change your password");
      return null;
    },
    { allowSuspended: true },
  );
}

export async function revokeSessionAction(token: string) {
  return userAction(
    async () => {
      const { error } = await getAuth().revokeSession({ token });
      if (error) throw new AppError("Could not sign out that device");
      revalidatePath("/account/security");
      return null;
    },
    { allowSuspended: true },
  );
}

export async function revokeOtherSessionsAction() {
  return userAction(
    async () => {
      const { error } = await getAuth().revokeOtherSessions();
      if (error) throw new AppError("Could not sign out other devices");
      revalidatePath("/account/security");
      return null;
    },
    { allowSuspended: true },
  );
}
