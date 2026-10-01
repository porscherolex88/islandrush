export type FiatDisplay = "USD" | "MYR";

export const FIAT_COOKIE = "lb_fiat";

/** MYR per 1 USD (display conversion only; ledger stays in MYR). */
export function usdMyrRate(): number {
  const raw = process.env.NEXT_PUBLIC_USD_MYR_RATE ?? process.env.USD_MYR_RATE;
  const n = raw ? Number(raw) : 4.47;
  return Number.isFinite(n) && n > 0 ? n : 4.47;
}

export function detectFiatDisplay(input: {
  cookie?: string | null;
  country?: string | null;
  acceptLanguage?: string | null;
}): FiatDisplay {
  if (input.cookie === "USD" || input.cookie === "MYR") return input.cookie;
  const country = input.country?.toUpperCase();
  if (country === "MY") return "MYR";
  const lang = input.acceptLanguage ?? "";
  if (/\ben-MY\b/i.test(lang) || /\bms(?:-|;|,|$)/i.test(lang)) return "MYR";
  return "USD";
}

export function readFiatCookieClient(): FiatDisplay | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${FIAT_COOKIE}=(USD|MYR)(?:;|$)`));
  return match ? (match[1] as FiatDisplay) : null;
}
