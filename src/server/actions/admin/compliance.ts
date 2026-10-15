"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { saveUpload } from "@/server/services/files";
import { upsertCountryControl } from "@/server/services/country-access";

function on(form: FormData, name: string) {
  return form.get(name) === "on" || form.get(name) === "true";
}

export async function upsertCountryControlAction(form: FormData) {
  return adminAction("system.manage", async (ctx) => {
    const parsed = z
      .object({
        countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code"),
        usdtTrc20Address: z.string().trim().max(128).optional(),
        bankName: z.string().trim().max(80).optional(),
        bankAccountName: z.string().trim().max(120).optional(),
        bankAccountNumber: z.string().trim().max(64).optional(),
        bankInstructions: z.string().trim().max(500).optional(),
        reason: z.string().trim().min(3).max(500),
      })
      .safeParse({
        countryCode: String(form.get("countryCode") ?? ""),
        usdtTrc20Address: String(form.get("usdtTrc20Address") ?? "") || undefined,
        bankName: String(form.get("bankName") ?? "") || undefined,
        bankAccountName: String(form.get("bankAccountName") ?? "") || undefined,
        bankAccountNumber: String(form.get("bankAccountNumber") ?? "") || undefined,
        bankInstructions: String(form.get("bankInstructions") ?? "") || undefined,
        reason: String(form.get("reason") ?? ""),
      });
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid form");

    let qrImageFileId: string | null | undefined = undefined;
    const qr = form.get("qr");
    if (qr instanceof File && qr.size > 0) {
      qrImageFileId = await saveUpload(ctx.user.id, qr, "country_qr");
    }

    await upsertCountryControl(
      parsed.data.countryCode,
      {
        siteAccess: on(form, "siteAccess"),
        freePlay: on(form, "freePlay"),
        depositsEnabled: on(form, "depositsEnabled"),
        withdrawalsEnabled: on(form, "withdrawalsEnabled"),
        usdtTrc20Address: parsed.data.usdtTrc20Address ?? null,
        bankName: parsed.data.bankName ?? null,
        bankAccountName: parsed.data.bankAccountName ?? null,
        bankAccountNumber: parsed.data.bankAccountNumber ?? null,
        bankInstructions: parsed.data.bankInstructions ?? null,
        ...(qrImageFileId !== undefined ? { qrImageFileId } : {}),
      },
      { id: ctx.user.id, role: ctx.role },
      parsed.data.reason,
    );
    revalidatePath("/admin/compliance/countries");
    return { countryCode: parsed.data.countryCode };
  });
}
