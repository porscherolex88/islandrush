"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestMeta } from "@/lib/auth/request";
import { requireAdminAllowPasswordChange } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/errors";
import {
  bootstrapAdminFromEnv,
  changeAdminPassword,
  clearAdminSessionCookie,
  loginAdmin,
  logoutAdmin,
  setAdminSessionCookie,
} from "@/server/services/admin-auth";

export type AdminAuthState = { error?: string };

export async function adminSignInAction(_prev: AdminAuthState, form: FormData): Promise<AdminAuthState> {
  await bootstrapAdminFromEnv();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password" };

  const meta = await getRequestMeta();
  const result = await loginAdmin(username, password, { ip: meta.ip, userAgent: meta.userAgent });
  if (!result.ok) return { error: result.error };

  await setAdminSessionCookie(result.token, result.expiresAt);
  if (result.admin.mustChangePassword) redirect("/admin/change-password");
  redirect("/admin");
}

export async function adminSignOutAction() {
  const meta = await getRequestMeta();
  const { getAdminSessionToken } = await import("@/server/services/admin-auth");
  await logoutAdmin(await getAdminSessionToken(), { ip: meta.ip, userAgent: meta.userAgent });
  redirect("/admin/login");
}

export async function adminChangePasswordAction(_prev: AdminAuthState, form: FormData): Promise<AdminAuthState> {
  const ctx = await requireAdminAllowPasswordChange();
  const parsed = z
    .object({
      currentPassword: z.string().min(1, "Enter your current password"),
      newPassword: z.string().min(12, "Use at least 12 characters"),
      confirmPassword: z.string().min(1),
    })
    .safeParse({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  if (parsed.data.newPassword !== parsed.data.confirmPassword) return { error: "New passwords do not match" };
  try {
    await changeAdminPassword(ctx.admin.id, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (err) {
    return { error: err instanceof AppError ? err.message : "Could not change password" };
  }
  redirect("/admin");
}

export async function adminClearSessionAction() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
