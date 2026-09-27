import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversions } from "@/db/schema";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { cashMinorToCredits, toDecimal, toMinor } from "@/lib/money";
import { getConfig } from "./config";
import { trackMission } from "./daily";
import { lockPlayer } from "./guards";
import { postTransaction } from "./ledger";

export async function getRate() {
  const rate = await getConfig("conversion");
  return { cashMinor: toMinor(rate.cash), credits: BigInt(rate.credits), cash: rate.cash, creditsNumber: rate.credits };
}

export function quote(cashAmount: string, rate: { cashMinor: bigint; credits: bigint }) {
  const cash = toMinor(cashAmount);
  return cashMinorToCredits(cash, rate.cashMinor, rate.credits);
}

/** Converts Cash to Credits at the configured rate. Cash never becomes Credits without a balanced ledger entry. */
export async function convertCashToCredits(userId: string, input: { cashAmount: string; idempotencyKey: string }) {
  const cash = toMinor(input.cashAmount);
  if (cash <= 0n) throw new AppError("Enter an amount greater than zero");
  const findExisting = async () =>
    (
      await db
        .select()
        .from(conversions)
        .where(and(eq(conversions.userId, userId), eq(conversions.idempotencyKey, input.idempotencyKey)))
        .limit(1)
    )[0];
  const prior = await findExisting();
  if (prior) return { conversion: prior, replayed: true };
  try {
    return await db.transaction(async (tx) => {
      await lockPlayer(tx, userId);
      const rateCfg = await getConfig("conversion", tx);
      const rateCash = toMinor(rateCfg.cash);
      const rateCredits = BigInt(rateCfg.credits);
      const creditsOut = cashMinorToCredits(cash, rateCash, rateCredits);
      if (creditsOut <= 0n) throw new AppError("Amount is too small to convert");
      const id = crypto.randomUUID();
      const posted = await postTransaction(tx, {
        type: "CONVERSION",
        userId,
        idempotencyKey: `conversion:${userId}:${input.idempotencyKey}`,
        description: `Converted RM${toDecimal(cash)} to ${creditsOut.toLocaleString()} Credits`,
        sourceType: "conversion",
        sourceId: id,
        metadata: { rateCash: rateCfg.cash, rateCredits: rateCfg.credits },
        entries: [
          { userId, account: "CASH", amount: -cash },
          { account: "SYS_CONVERSION", currency: "MYR", amount: cash },
          { account: "SYS_CREDIT_ISSUANCE", currency: "CREDITS", amount: -creditsOut },
          { userId, account: "CREDITS", amount: creditsOut },
        ],
      });
      const [row] = await tx
        .insert(conversions)
        .values({
          id,
          userId,
          cashAmount: toDecimal(cash),
          credits: Number(creditsOut),
          rateCash: rateCfg.cash,
          rateCredits: rateCfg.credits,
          idempotencyKey: input.idempotencyKey,
          ledgerTransactionId: posted.transactionId,
        })
        .returning();
      await trackMission(tx, userId, "CONVERT_CREDITS");
      return { conversion: row, replayed: false };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const row = await findExisting();
      if (row) return { conversion: row, replayed: true };
    }
    throw err;
  }
}
