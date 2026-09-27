"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userAction } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { formatMYR } from "@/lib/money";
import { convertCashToCredits } from "@/server/services/conversion";
import { createDeposit } from "@/server/services/deposits";
import { saveUpload } from "@/server/services/files";
import { rateLimit } from "@/server/services/rate-limit";
import {
  addWithdrawalAccount,
  archiveWithdrawalAccount,
  cancelWithdrawal,
  requestWithdrawal,
  setDefaultWithdrawalAccount,
} from "@/server/services/withdrawals";
import { assertPlayable } from "./guard";

const amount = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter a valid amount, e.g. 150 or 150.50");
const key = z.string().min(8).max(100);

function field(form: FormData, name: string) {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

export async function createDepositAction(form: FormData) {
  return userAction(async (user) => {
    await assertPlayable(user, "deposits");
    await rateLimit(`deposit:${user.id}`, 10, 3600);
    const parsed = z
      .object({
        amount,
        method: z.string().min(1),
        paymentAccountId: z.string().uuid().optional().or(z.literal("")),
        reference: z.string().trim().min(3, "Enter your transfer reference").max(80),
        payerName: z.string().trim().min(2, "Enter the account holder name").max(120),
        note: z.string().trim().max(500).optional(),
        idempotencyKey: key,
      })
      .safeParse({
        amount: field(form, "amount"),
        method: field(form, "method"),
        paymentAccountId: field(form, "paymentAccountId"),
        reference: field(form, "reference"),
        payerName: field(form, "payerName"),
        note: field(form, "note") || undefined,
        idempotencyKey: field(form, "idempotencyKey"),
      });
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Please check the form");
    const proof = form.get("proof");
    let proofFileId: string | null = null;
    if (proof instanceof File && proof.size > 0) proofFileId = await saveUpload(user.id, proof, "deposit_proof");
    const d = parsed.data;
    const row = await createDeposit(user.id, {
      amount: d.amount,
      method: d.method,
      paymentAccountId: d.paymentAccountId || null,
      reference: d.reference,
      payerName: d.payerName,
      note: d.note ?? null,
      proofFileId,
      idempotencyKey: d.idempotencyKey,
    });
    revalidatePath("/app/wallet", "layout");
    return { id: row.id, amount: row.amount };
  });
}

export async function convertAction(input: { cashAmount: string; idempotencyKey: string }) {
  return userAction(async (user) => {
    const d = z.object({ cashAmount: amount, idempotencyKey: key }).safeParse(input);
    if (!d.success) throw new AppError(d.error.issues[0]?.message ?? "Invalid amount");
    await assertPlayable(user);
    const { conversion } = await convertCashToCredits(user.id, d.data);
    revalidatePath("/app", "layout");
    return { cashAmount: conversion.cashAmount, credits: conversion.credits };
  });
}

export async function requestWithdrawalAction(input: { amount: string; withdrawalAccountId: string; idempotencyKey: string }) {
  return userAction(async (user) => {
    const d = z.object({ amount, withdrawalAccountId: z.string().uuid("Choose a withdrawal account"), idempotencyKey: key }).safeParse(input);
    if (!d.success) throw new AppError(d.error.issues[0]?.message ?? "Please check the form");
    await assertPlayable(user, "withdrawals");
    await rateLimit(`withdraw:${user.id}`, 10, 3600);
    const w = await requestWithdrawal(user.id, d.data);
    revalidatePath("/app", "layout");
    return { id: w.id, status: w.status, amount: w.amount, message: `Withdrawal of ${formatMYR(w.amount)} requested` };
  });
}

export async function cancelWithdrawalAction(id: string) {
  return userAction(async (user) => {
    await cancelWithdrawal(user.id, z.string().uuid().parse(id));
    revalidatePath("/app", "layout");
    return null;
  });
}

export async function addWithdrawalAccountAction(input: { bankName: string; accountName: string; accountNumber: string }) {
  return userAction(async (user) => {
    const d = z
      .object({
        bankName: z.string().trim().min(2, "Choose your bank").max(80),
        accountName: z.string().trim().min(2, "Enter the account holder name").max(120),
        accountNumber: z
          .string()
          .trim()
          .regex(/^[0-9 ]{6,24}$/, "Account numbers contain 6-24 digits"),
      })
      .safeParse(input);
    if (!d.success) throw new AppError(d.error.issues[0]?.message ?? "Please check the form");
    await rateLimit(`wacct:${user.id}`, 10, 3600);
    const row = await addWithdrawalAccount(user.id, d.data);
    revalidatePath("/app", "layout");
    return { id: row.id };
  });
}

export async function archiveWithdrawalAccountAction(id: string) {
  return userAction(async (user) => {
    await archiveWithdrawalAccount(user.id, z.string().uuid().parse(id));
    revalidatePath("/app", "layout");
    return null;
  });
}

export async function setDefaultWithdrawalAccountAction(id: string) {
  return userAction(async (user) => {
    await setDefaultWithdrawalAccount(user.id, z.string().uuid().parse(id));
    revalidatePath("/app", "layout");
    return null;
  });
}
