/**
 * Money helpers. Persisted money is NUMERIC(20,2); in code all arithmetic is done
 * on bigint minor units (sen for MYR, whole credits for CREDITS). Never use floats.
 */

export type Currency = "MYR" | "CREDITS";

const SCALE: Record<Currency, number> = { MYR: 2, CREDITS: 0 };

export function toMinor(value: string | number | bigint, currency: Currency = "MYR"): bigint {
  if (typeof value === "bigint") return value * 10n ** BigInt(SCALE[currency]);
  const str = typeof value === "number" ? value.toString() : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new Error(`Invalid amount: ${value}`);
  const negative = str.startsWith("-");
  const [whole, frac = ""] = str.replace("-", "").split(".");
  const scale = SCALE[currency];
  // Numeric columns may carry trailing zeros beyond the currency scale (e.g. credits stored as "8000.00").
  const extra = frac.slice(scale);
  if (/[1-9]/.test(extra)) throw new Error(`Amount has too many decimal places: ${value}`);
  const fracPadded = frac.slice(0, scale).padEnd(scale, "0");
  const minor = BigInt(whole + fracPadded);
  return negative ? -minor : minor;
}

/** Converts minor units to a NUMERIC-compatible decimal string with 2 dp. */
export function toDecimal(minor: bigint, currency: Currency = "MYR"): string {
  const scale = SCALE[currency];
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  // Normalise both currencies to 2 dp so they fit the shared NUMERIC(20,2) columns.
  const cents = abs * 10n ** BigInt(2 - scale);
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

export function formatMYR(value: string | bigint, opts: { sign?: boolean } = {}): string {
  const minor = typeof value === "bigint" ? value : toMinor(value, "MYR");
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = (abs / 100n).toLocaleString("en-MY");
  const frac = (abs % 100n).toString().padStart(2, "0");
  const sign = negative ? "-" : opts.sign && minor > 0n ? "+" : "";
  return `${sign}RM${whole}.${frac}`;
}

export function formatCredits(value: number | bigint | string, opts: { sign?: boolean } = {}): string {
  const n = typeof value === "string" ? toMinor(value, "CREDITS") : BigInt(value);
  const sign = n < 0n ? "-" : opts.sign && n > 0n ? "+" : "";
  const abs = n < 0n ? -n : n;
  return `${sign}${abs.toLocaleString("en-MY")}`;
}

/** Credits -> MYR minor units at a given rate (rateCash MYR buys rateCredits credits). Rounded half-up to the sen. */
export function creditsToCashMinor(creditsAmount: bigint, rateCashMinor: bigint, rateCredits: bigint): bigint {
  if (rateCredits <= 0n) throw new Error("Invalid conversion rate");
  const numerator = creditsAmount * rateCashMinor;
  return (numerator * 2n + rateCredits) / (rateCredits * 2n);
}

/** MYR minor units -> credits (floored so users never receive fractional credits). */
export function cashMinorToCredits(cashMinor: bigint, rateCashMinor: bigint, rateCredits: bigint): bigint {
  if (rateCashMinor <= 0n) throw new Error("Invalid conversion rate");
  return (cashMinor * rateCredits) / rateCashMinor;
}

export function minBig(a: bigint, b: bigint) {
  return a < b ? a : b;
}
