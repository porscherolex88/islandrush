"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestMeta } from "@/lib/auth/request";
import { getAuth } from "@/lib/auth/server";
import { RateLimitError } from "@/lib/errors";
import { isFeatureEnabled } from "@/server/services/config";
import { ensureProfile, recordLogin } from "@/server/services/profiles";
import { rateLimit } from "@/server/services/rate-limit";

export type AuthFormState = { error?: string; fields?: Record<string, string> };

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/api") ? next : "/app";
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

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const fields = { email };
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address", fields };
  if (!password) return { error: "Enter your password", fields };

  const meta = await getRequestMeta();
  if ((await limited(`login:ip:${meta.ip ?? "unknown"}`, 20, 900)) || (await limited(`login:email:${email}`, 8, 900))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again.", fields };
  }

  const { data, error } = await getAuth().signIn.email({ email, password });
  if (error || !data?.user) {
    await recordLogin({ userId: null, email, success: false, ip: meta.ip, userAgent: meta.userAgent, deviceId: meta.deviceId });
    return { error: "That email and password combination doesn't match our records.", fields };
  }
  const profile = await ensureProfile(
    { id: data.user.id, email: data.user.email, name: data.user.name },
    { ip: meta.ip, deviceId: meta.deviceId, referralCode: meta.referralCode },
  );
  await recordLogin({ userId: profile.id, email, success: true, ip: meta.ip, userAgent: meta.userAgent, deviceId: meta.deviceId });
  redirect(safeNext(form.get("next")));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters for your password").max(128),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,12}$/, "Referral codes contain letters and numbers only"),
  terms: z.literal("on", { message: "Please accept the Terms and confirm you are 18 or older" }),
});

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    referralCode: String(form.get("referralCode") ?? ""),
    terms: form.get("terms") ?? undefined,
  };
  const fields = { name: raw.name, email: raw.email, referralCode: raw.referralCode };
  if (!(await isFeatureEnabled("registrations"))) return { error: "New registrations are paused right now. Please try again later.", fields };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form", fields };

  const meta = await getRequestMeta();
  if (await limited(`signup:ip:${meta.ip ?? "unknown"}`, 5, 3600)) {
    return { error: "Too many sign-ups from this network. Please try again later.", fields };
  }

  const { name, email, password, referralCode } = parsed.data;
  const { data, error } = await getAuth().signUp.email({ name, email, password });
  if (error || !data?.user) {
    const exists = error?.message?.toLowerCase().includes("exist");
    return { error: exists ? "An account with this email already exists. Try signing in instead." : "We couldn't create your account. Please try again.", fields };
  }
  const profile = await ensureProfile(
    { id: data.user.id, email: data.user.email, name: data.user.name },
    { ip: meta.ip, deviceId: meta.deviceId, referralCode: referralCode || meta.referralCode },
  );
  await recordLogin({ userId: profile.id, email, success: true, ip: meta.ip, userAgent: meta.userAgent, deviceId: meta.deviceId });
  redirect("/app?welcome=1");
}

export async function signOutAction() {
  await getAuth().signOut();
  redirect("/login");
}
