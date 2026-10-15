"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isAtLeast18, parseIsoDate } from "@/lib/age";
import { getRequestMeta } from "@/lib/auth/request";
import { getAuth } from "@/lib/auth/server";
import { AppError, RateLimitError } from "@/lib/errors";
import { isAdminRole } from "@/lib/permissions";
import { looksLikeEmail, normalizeMyPhone, phoneAuthEmail } from "@/lib/phone";
import { isFeatureEnabled } from "@/server/services/config";
import { ensureProfile, findProfileByLogin, recordLogin } from "@/server/services/profiles";
import { rateLimit } from "@/server/services/rate-limit";
import { createPasswordResetRequest } from "@/server/services/support";

export type AuthFormState = { error?: string; fields?: Record<string, string>; success?: string };

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api") ? next : "/home";
}

async function limited(key: string, limit: number, windowSeconds: number) {
  try {
    await rateLimit(key, limit, windowSeconds);
    return false;
  } catch (err) {
    if (err instanceof RateLimitError) return true;
    throw err;
  }
}

/** Resolve Neon Auth email for a login identifier (phone or legacy email). */
async function authEmailForLogin(identifier: string): Promise<{ email: string; phone?: string } | null> {
  const trimmed = identifier.trim();
  if (looksLikeEmail(trimmed)) {
    const email = trimmed.toLowerCase();
    if (!z.string().email().safeParse(email).success) return null;
    return { email };
  }
  const phone = normalizeMyPhone(trimmed);
  if (!phone) return null;
  const profile = await findProfileByLogin(phone);
  if (profile) return { email: profile.email.toLowerCase(), phone };
  return { email: phoneAuthEmail(phone), phone };
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const identifier = String(form.get("phone") ?? form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const fields = { phone: identifier };
  if (!identifier) return { error: "Enter your phone number", fields };
  if (!password) return { error: "Enter your password", fields };

  const resolved = await authEmailForLogin(identifier);
  if (!resolved) {
    return {
      error: looksLikeEmail(identifier)
        ? "Enter a valid email address, or use the phone number on your account."
        : "Enter a valid Malaysian phone number, e.g. 012 345 6789",
      fields,
    };
  }

  const meta = await getRequestMeta();
  const rateKey = resolved.phone ?? resolved.email;
  if ((await limited(`login:ip:${meta.ip ?? "unknown"}`, 20, 900)) || (await limited(`login:id:${rateKey}`, 8, 900))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again.", fields };
  }

  const { data, error } = await getAuth().signIn.email({ email: resolved.email, password });
  if (error || !data?.user) {
    await recordLogin({ userId: null, email: resolved.email, success: false, ip: meta.ip, userAgent: meta.userAgent, deviceId: meta.deviceId });
    return { error: "That login and password combination doesn't match our records.", fields };
  }
  const profile = await ensureProfile(
    { id: data.user.id, email: data.user.email, name: data.user.name },
    { ip: meta.ip, deviceId: meta.deviceId, referralCode: meta.referralCode, phone: resolved.phone },
  );
  if (isAdminRole(profile.role)) {
    await getAuth().signOut();
    await recordLogin({
      userId: profile.id,
      email: resolved.email,
      success: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
      deviceId: meta.deviceId,
    });
    return { error: "Staff accounts sign in through the admin console at /admin/login.", fields };
  }
  await recordLogin({
    userId: profile.id,
    email: resolved.email,
    success: true,
    ip: meta.ip,
    userAgent: meta.userAgent,
    deviceId: meta.deviceId,
  });
  redirect(safeNext(form.get("next")));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().min(8, "Enter your phone number"),
  password: z.string().min(8, "Use at least 8 characters for your password").max(128),
  dateOfBirth: z.string().trim().min(1, "Enter your date of birth"),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,12}$/, "Referral codes contain letters and numbers only"),
  terms: z.literal("on", { message: "Please accept the Terms" }),
});

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    password: String(form.get("password") ?? ""),
    dateOfBirth: String(form.get("dateOfBirth") ?? ""),
    referralCode: String(form.get("referralCode") ?? ""),
    terms: form.get("terms") ?? undefined,
  };
  const fields = { name: raw.name, phone: raw.phone, dateOfBirth: raw.dateOfBirth, referralCode: raw.referralCode };
  if (!(await isFeatureEnabled("registrations"))) return { error: "New registrations are paused right now. Please try again later.", fields };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form", fields };

  const phone = normalizeMyPhone(parsed.data.phone);
  if (!phone) return { error: "Enter a valid Malaysian phone number, e.g. 012 345 6789", fields };

  const dob = parseIsoDate(parsed.data.dateOfBirth);
  if (!dob) return { error: "Enter a valid date of birth", fields };
  if (!isAtLeast18(dob)) return { error: "You must be 18 or older to create an account", fields };

  const meta = await getRequestMeta();
  if (await limited(`signup:ip:${meta.ip ?? "unknown"}`, 5, 3600)) {
    return { error: "Too many sign-ups from this network. Please try again later.", fields };
  }

  const [phoneTaken] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.phone, phone)).limit(1);
  if (phoneTaken) return { error: "An account with this phone number already exists. Try signing in instead.", fields };

  const { name, password, referralCode } = parsed.data;
  const email = phoneAuthEmail(phone);
  const dobIso = parsed.data.dateOfBirth;
  const { data, error } = await getAuth().signUp.email({ name, email, password });
  if (error || !data?.user) {
    const exists = error?.message?.toLowerCase().includes("exist");
    return { error: exists ? "An account with this phone number already exists. Try signing in instead." : "We couldn't create your account. Please try again.", fields };
  }
  const { assertSiteAccess } = await import("@/server/services/country-access");
  await assertSiteAccess(meta.country);
  const profile = await ensureProfile(
    { id: data.user.id, email: data.user.email, name: data.user.name },
    {
      ip: meta.ip,
      deviceId: meta.deviceId,
      referralCode: referralCode || meta.referralCode,
      phone,
      dateOfBirth: dobIso,
      country: meta.country,
    },
  );
  await recordLogin({ userId: profile.id, email, success: true, ip: meta.ip, userAgent: meta.userAgent, deviceId: meta.deviceId });
  redirect("/home?welcome=1");
}

export async function forgotPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const phoneOrName = String(form.get("phoneOrName") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const fields = { phoneOrName, message };
  if (phoneOrName.length < 2) return { error: "Enter your phone number or the name on your account", fields };
  if (message.length < 10) return { error: "Tell us a little more so we can help (at least 10 characters)", fields };

  const meta = await getRequestMeta();
  if (await limited(`forgot:ip:${meta.ip ?? "unknown"}`, 5, 3600)) {
    return { error: "Too many requests from this network. Please try again later.", fields };
  }

  try {
    await createPasswordResetRequest({ phoneOrName, message });
  } catch (err) {
    if (err instanceof AppError) return { error: err.message, fields };
    return { error: "We couldn't send your request. Please try again.", fields };
  }
  return {
    success: "Request sent. Support will review it and help you reset your password. This usually takes a few hours.",
    fields: { phoneOrName },
  };
}

export async function signOutAction() {
  await getAuth().signOut();
  redirect("/login");
}
