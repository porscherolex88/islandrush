import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { db, type DbOrTx } from "@/db";
import { countryControls } from "@/db/schema";
import { isRealMoneyRestrictedCountry } from "@/lib/compliance/restricted-countries";
import { resolveAccessFlags } from "@/lib/compliance/resolve-access";
import { AppError, ForbiddenError } from "@/lib/errors";
import { audit } from "./audit";

export type CountryControlRow = typeof countryControls.$inferSelect;

export type CountryPaymentMethods = {
  usdtAddress: string | null;
  bank: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    instructions: string;
  } | null;
  qrImageFileId: string | null;
};

export type ResolvedCountryAccess = ReturnType<typeof resolveAccessFlags> & {
  countryCode: string | null;
  payments: CountryPaymentMethods;
};

function normalizeCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || c === "XX" || c === "T1") return null;
  return c;
}

export const getRequestCountry = cache(async (): Promise<string | null> => {
  try {
    const h = await headers();
    return normalizeCountry(h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"));
  } catch {
    return null;
  }
});

function globalUsdtAddress(): string | null {
  const v = process.env.USDT_TRC20_WALLET?.trim();
  return v || null;
}

function hasBankDetails(row: CountryControlRow | null | undefined): boolean {
  if (!row) return false;
  return Boolean(row.bankName?.trim() && row.bankAccountName?.trim() && row.bankAccountNumber?.trim());
}

/**
 * Merges hard-coded restricted list, licence gate, and admin country_controls.
 * USDT is the default deposit method when deposits are allowed; bank/QR only when
 * the admin configured them for that country.
 */
export async function resolveCountryAccess(
  countryCode: string | null | undefined,
  tx: DbOrTx = db,
): Promise<ResolvedCountryAccess> {
  const code = normalizeCountry(countryCode);
  let row: CountryControlRow | null = null;
  if (code) {
    const [found] = await tx.select().from(countryControls).where(eq(countryControls.countryCode, code)).limit(1);
    row = found ?? null;
  }

  const flags = resolveAccessFlags(
    code,
    row
      ? {
          siteAccess: row.siteAccess,
          freePlay: row.freePlay,
          depositsEnabled: row.depositsEnabled,
          withdrawalsEnabled: row.withdrawalsEnabled,
        }
      : null,
  );

  const usdtAddress = (row?.usdtTrc20Address?.trim() || globalUsdtAddress()) ?? null;

  return {
    ...flags,
    countryCode: code,
    payments: {
      usdtAddress,
      bank: hasBankDetails(row)
        ? {
            bankName: row!.bankName!.trim(),
            accountName: row!.bankAccountName!.trim(),
            accountNumber: row!.bankAccountNumber!.trim(),
            instructions: row!.bankInstructions?.trim() || "",
          }
        : null,
      qrImageFileId: row?.qrImageFileId ?? null,
    },
  };
}

/** USDT always first when available; bank/QR only if admin configured for the country. */
export function availableDepositMethods(access: ResolvedCountryAccess): string[] {
  if (!access.deposits) return [];
  const methods: string[] = [];
  if (access.payments.usdtAddress) methods.push("USDT_TRC20");
  if (access.payments.bank) methods.push("BANK_TRANSFER");
  if (access.payments.qrImageFileId) methods.push("QR_TRANSFER");
  return methods;
}

export async function assertSiteAccess(countryCode: string | null | undefined, tx: DbOrTx = db) {
  const access = await resolveCountryAccess(countryCode, tx);
  if (!access.siteAccess) throw new ForbiddenError("LootBox is not available in your country.");
  return access;
}

export async function assertDepositsAllowed(countryCode: string | null | undefined, tx: DbOrTx = db) {
  const access = await resolveCountryAccess(countryCode, tx);
  if (!access.deposits) {
    throw new AppError(access.depositBlockReason ?? "Deposits are not available.", "DEPOSITS_BLOCKED", 403);
  }
  const methods = availableDepositMethods(access);
  if (methods.length === 0) {
    throw new AppError("No deposit methods are configured for your country yet.", "DEPOSITS_UNCONFIGURED", 403);
  }
  return access;
}

export async function assertWithdrawalsAllowed(countryCode: string | null | undefined, tx: DbOrTx = db) {
  const access = await resolveCountryAccess(countryCode, tx);
  if (!access.withdrawals) {
    throw new AppError(access.withdrawalBlockReason ?? "Withdrawals are not available.", "WITHDRAWALS_BLOCKED", 403);
  }
  return access;
}

export async function listCountryControls(tx: DbOrTx = db) {
  return tx.select().from(countryControls).orderBy(countryControls.countryCode);
}

export async function getCountryControl(countryCode: string, tx: DbOrTx = db) {
  const code = normalizeCountry(countryCode);
  if (!code) return null;
  const [row] = await tx.select().from(countryControls).where(eq(countryControls.countryCode, code)).limit(1);
  return row ?? null;
}

export async function upsertCountryControl(
  countryCode: string,
  patch: Partial<Omit<typeof countryControls.$inferInsert, "countryCode" | "createdAt">>,
  actor: { id: string; role: string },
  reason?: string | null,
  tx: DbOrTx = db,
) {
  const code = normalizeCountry(countryCode);
  if (!code) throw new AppError("Enter a valid 2-letter country code");
  const restricted = isRealMoneyRestrictedCountry(code);
  const depositsEnabled = restricted ? false : Boolean(patch.depositsEnabled);
  const withdrawalsEnabled = restricted ? false : Boolean(patch.withdrawalsEnabled);

  const [before] = await tx.select().from(countryControls).where(eq(countryControls.countryCode, code)).limit(1);

  const values = {
    countryCode: code,
    siteAccess: patch.siteAccess ?? before?.siteAccess ?? true,
    freePlay: patch.freePlay ?? before?.freePlay ?? true,
    depositsEnabled,
    withdrawalsEnabled,
    bankName: patch.bankName ?? null,
    bankAccountName: patch.bankAccountName ?? null,
    bankAccountNumber: patch.bankAccountNumber ?? null,
    bankInstructions: patch.bankInstructions ?? null,
    qrImageFileId: patch.qrImageFileId !== undefined ? patch.qrImageFileId : (before?.qrImageFileId ?? null),
    usdtTrc20Address: patch.usdtTrc20Address ?? null,
    updatedBy: actor.id,
    updatedAt: new Date(),
  };

  const [row] = await tx
    .insert(countryControls)
    .values(values)
    .onConflictDoUpdate({
      target: countryControls.countryCode,
      set: {
        siteAccess: values.siteAccess,
        freePlay: values.freePlay,
        depositsEnabled: values.depositsEnabled,
        withdrawalsEnabled: values.withdrawalsEnabled,
        bankName: values.bankName,
        bankAccountName: values.bankAccountName,
        bankAccountNumber: values.bankAccountNumber,
        bankInstructions: values.bankInstructions,
        qrImageFileId: values.qrImageFileId,
        usdtTrc20Address: values.usdtTrc20Address,
        updatedBy: actor.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  await audit(tx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: "country_controls.upsert",
    entityType: "country_controls",
    entityId: code,
    before: before ?? null,
    after: row,
    reason: reason ?? null,
  });
  return row;
}
