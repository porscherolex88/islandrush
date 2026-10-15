/**
 * USDT TRC20 deposit matching via TronGrid.
 *
 * Matching strategy: unique expected amount (6 decimal places).
 * When a player opens a USDT deposit for a whole/2-dp cash amount, we assign a
 * unique crypto_expected_amount by adding a random micro-offset in the last
 * 4 decimal places (e.g. 50.000137 USDT). The player must send that exact
 * amount. The cron job polls TronGrid for TRC20 transfers to our wallet,
 * matches on exact amount, waits for confirmations, then credits Cash
 * idempotently (unique crypto_tx_id + usdt_credit_logs.tx_id).
 */
import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { deposits, usdtCreditLogs } from "@/db/schema";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { toDecimal, toMinor } from "@/lib/money";

/** Official USDT TRC20 contract on Tron mainnet. */
export const USDT_TRC20_CONTRACT = process.env.USDT_TRC20_CONTRACT?.trim() || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const USDT_MIN_CONFIRMATIONS = Number(process.env.USDT_MIN_CONFIRMATIONS ?? "20") || 20;
const TRONGRID_BASE = process.env.TRONGRID_BASE_URL?.trim() || "https://api.trongrid.io";

const SYSTEM_ACTOR = { id: "system:usdt", role: "SYSTEM" };

/** Allocates a unique 6-dp USDT amount near the requested whole amount. */
export async function allocateUniqueUsdtAmount(baseAmount: string): Promise<string> {
  const base = toMinor(baseAmount);
  const baseMicros = base * 10_000n;
  for (let i = 0; i < 40; i++) {
    const offset = BigInt(Math.floor(Math.random() * 9_999) + 1);
    const micros = baseMicros + offset;
    const whole = micros / 1_000_000n;
    const frac = (micros % 1_000_000n).toString().padStart(6, "0");
    const expected = `${whole}.${frac}`;
    const [clash] = await db
      .select({ id: deposits.id })
      .from(deposits)
      .where(and(eq(deposits.cryptoExpectedAmount, expected), eq(deposits.status, "PENDING")))
      .limit(1);
    if (!clash) return expected;
  }
  throw new AppError("Could not allocate a unique USDT amount. Please try again.");
}

type TronTransfer = {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  block_timestamp?: number;
  confirmed?: boolean;
};

async function trongridFetch(path: string): Promise<unknown> {
  const key = process.env.TRONGRID_API_KEY?.trim();
  if (!key) throw new AppError("TRONGRID_API_KEY is not configured", "TRONGRID_CONFIG", 503);
  const res = await fetch(`${TRONGRID_BASE}${path}`, {
    headers: { Accept: "application/json", "TRON-PRO-API-KEY": key },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new AppError(`TronGrid error ${res.status}`, "TRONGRID_ERROR", 502);
  return res.json();
}

function microsToAmount(value: string, decimals = 6): string {
  const n = BigInt(value);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

async function currentBlockNumber(): Promise<number> {
  const data = (await trongridFetch("/wallet/getnowblock")) as { block_header?: { raw_data?: { number?: number } } };
  const n = data.block_header?.raw_data?.number;
  if (!n) throw new AppError("Could not read Tron tip block", "TRONGRID_ERROR", 502);
  return n;
}

async function listIncomingUsdt(toAddress: string, minTimestamp: number): Promise<TronTransfer[]> {
  const path =
    `/v1/accounts/${encodeURIComponent(toAddress)}/transactions/trc20` +
    `?only_to=true&contract_address=${encodeURIComponent(USDT_TRC20_CONTRACT)}` +
    `&min_timestamp=${minTimestamp}&limit=200&order_by=block_timestamp,desc`;
  const data = (await trongridFetch(path)) as { data?: TronTransfer[] };
  return data.data ?? [];
}

async function confirmationsFor(txId: string): Promise<number> {
  try {
    const tip = await currentBlockNumber();
    const infoRes = await fetch(`${TRONGRID_BASE}/wallet/gettransactioninfobyid`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY!.trim(),
      },
      body: JSON.stringify({ value: txId }),
    });
    if (!infoRes.ok) return 0;
    const info = (await infoRes.json()) as { blockNumber?: number };
    if (!info.blockNumber) return 0;
    return Math.max(0, tip - info.blockNumber + 1);
  } catch {
    return 0;
  }
}

/** Poll TronGrid and credit matching pending USDT deposits. Idempotent. */
export async function pollUsdtDeposits(): Promise<{ scanned: number; matched: number; credited: number }> {
  const wallet = process.env.USDT_TRC20_WALLET?.trim();
  if (!wallet) return { scanned: 0, matched: 0, credited: 0 };
  if (!process.env.TRONGRID_API_KEY?.trim()) return { scanned: 0, matched: 0, credited: 0 };

  const pending = await db
    .select()
    .from(deposits)
    .where(and(eq(deposits.method, "USDT_TRC20"), eq(deposits.status, "PENDING"), isNull(deposits.cryptoTxId)));

  if (pending.length === 0) return { scanned: 0, matched: 0, credited: 0 };

  const oldest = Math.min(...pending.map((p) => p.createdAt.getTime())) - 3_600_000;
  const transfers = await listIncomingUsdt(wallet, oldest);
  let matched = 0;
  let credited = 0;

  const byAmount = new Map<string, TronTransfer[]>();
  for (const t of transfers) {
    const amt = microsToAmount(t.value, 6);
    const list = byAmount.get(amt) ?? [];
    list.push(t);
    byAmount.set(amt, list);
  }

  for (const dep of pending) {
    if (!dep.cryptoExpectedAmount) continue;
    const candidates = byAmount.get(dep.cryptoExpectedAmount) ?? [];
    if (!candidates.length) continue;
    const tx = candidates.shift()!;
    matched += 1;
    const conf = await confirmationsFor(tx.transaction_id);
    await db
      .update(deposits)
      .set({
        cryptoTxId: tx.transaction_id,
        cryptoConfirmations: conf,
        cryptoToAddress: wallet,
        reference: dep.reference || tx.transaction_id.slice(0, 16),
        updatedAt: new Date(),
      })
      .where(and(eq(deposits.id, dep.id), isNull(deposits.cryptoTxId)));

    if (conf >= USDT_MIN_CONFIRMATIONS) {
      const did = await creditUsdtDeposit(dep.id, {
        txId: tx.transaction_id,
        fromAddress: tx.from,
        toAddress: wallet,
        amount: dep.cryptoExpectedAmount,
        confirmations: conf,
        raw: tx as unknown as Record<string, unknown>,
      });
      if (did) credited += 1;
    }
  }

  // Also advance confirmations on already-matched pending deposits
  const awaiting = await db
    .select()
    .from(deposits)
    .where(and(eq(deposits.method, "USDT_TRC20"), eq(deposits.status, "PENDING"), sql`${deposits.cryptoTxId} is not null`));
  for (const dep of awaiting) {
    if (!dep.cryptoTxId || !dep.cryptoExpectedAmount) continue;
    const conf = await confirmationsFor(dep.cryptoTxId);
    await db.update(deposits).set({ cryptoConfirmations: conf, updatedAt: new Date() }).where(eq(deposits.id, dep.id));
    if (conf >= USDT_MIN_CONFIRMATIONS) {
      const did = await creditUsdtDeposit(dep.id, {
        txId: dep.cryptoTxId,
        fromAddress: null,
        toAddress: dep.cryptoToAddress ?? wallet,
        amount: dep.cryptoExpectedAmount,
        confirmations: conf,
        raw: {},
      });
      if (did) credited += 1;
    }
  }

  return { scanned: transfers.length, matched, credited };
}

async function creditUsdtDeposit(
  depositId: string,
  input: {
    txId: string;
    fromAddress: string | null;
    toAddress: string;
    amount: string;
    confirmations: number;
    raw: Record<string, unknown>;
  },
): Promise<boolean> {
  const [existing] = await db.select().from(usdtCreditLogs).where(eq(usdtCreditLogs.txId, input.txId)).limit(1);
  if (existing) return false;

  const [dep] = await db.select().from(deposits).where(eq(deposits.id, depositId)).limit(1);
  if (!dep || dep.status === "APPROVED") return false;

  try {
    const { approveDeposit } = await import("./deposits");
    await approveDeposit(SYSTEM_ACTOR, depositId, `USDT TRC20 auto-credit tx ${input.txId}`);
  } catch (err) {
    if (err instanceof AppError) return false;
    throw err;
  }

  try {
    await db.insert(usdtCreditLogs).values({
      depositId,
      userId: dep.userId,
      txId: input.txId,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      amount: input.amount,
      confirmations: input.confirmations,
      creditedCash: toDecimal(toMinor(dep.amount)),
      raw: input.raw,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
  return true;
}

export async function listUsdtCreditLogs(limit = 50) {
  return db.select().from(usdtCreditLogs).orderBy(sql`${usdtCreditLogs.createdAt} desc`).limit(limit);
}
