import "server-only";
import { getFiatDisplay, type FiatDisplay } from "@/lib/fiat-display";
import { formatCash } from "@/lib/money";

/** Formats stored MYR amounts in the visitor's display currency (USD or MYR). */
export async function formatMoney(
  value: string | bigint,
  opts: { sign?: boolean; currency?: FiatDisplay } = {},
): Promise<string> {
  const currency = opts.currency ?? (await displayCurrency());
  return formatCash(value, { currency, sign: opts.sign });
}

/** Outside a request (cron jobs, scripts, tests) there is no visitor, so stored MYR is shown as-is. */
async function displayCurrency(): Promise<FiatDisplay> {
  try {
    return await getFiatDisplay();
  } catch (err) {
    if (err instanceof Error && err.message.includes("outside a request scope")) return "MYR";
    throw err;
  }
}

/** Shorthand for server-side user-facing error copy and notifications. */
export async function fmtCash(value: string | bigint, opts: { sign?: boolean } = {}) {
  return formatMoney(value, opts);
}
