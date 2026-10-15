/**
 * Hard-coded real-money restrictions for Compliance review.
 *
 * Admin country controls CANNOT override deposits or withdrawals for these
 * ISO 3166-1 alpha-2 codes. Free play and login remain allowed (subject to
 * separate site-access / free-play toggles).
 *
 * Includes jurisdiction restrictions requested by the operator plus FATF
 * high-risk / blacklisted jurisdictions (as of this file's last edit).
 * Update this list only via code review.
 */

export const RESTRICTED_REAL_MONEY_COUNTRIES = [
  // Operator-restricted jurisdictions
  "MY", // Malaysia
  "SG", // Singapore
  "US", // United States
  "GB", // United Kingdom
  "FR", // France
  "NL", // Netherlands
  "AU", // Australia
  "CN", // China
  "ID", // Indonesia
  "BN", // Brunei
  "AE", // UAE
  "SA", // Saudi Arabia
  "QA", // Qatar
  "KW", // Kuwait
  "BH", // Bahrain
  "OM", // Oman
  "BE", // Belgium
  "KR", // South Korea
  // FATF blacklisted / call-for-action jurisdictions
  "KP", // North Korea
  "IR", // Iran
  "MM", // Myanmar
] as const;

export type RestrictedRealMoneyCountry = (typeof RESTRICTED_REAL_MONEY_COUNTRIES)[number];

const RESTRICTED_SET = new Set<string>(RESTRICTED_REAL_MONEY_COUNTRIES);

/** True when deposits and withdrawals must stay off regardless of admin toggles. */
export function isRealMoneyRestrictedCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return RESTRICTED_SET.has(countryCode.trim().toUpperCase());
}

export const REAL_MONEY_RESTRICTED_BANNER =
  "Real-money features aren't available in your country. You can still play our free games.";
