/**
 * Pure access-resolution helpers (no DB / server-only). Used by country-access
 * and unit-tested for licence gate + restricted-country lock behaviour.
 */

import {
  isRealMoneyRestrictedCountry,
  REAL_MONEY_RESTRICTED_BANNER,
} from "@/lib/compliance/restricted-countries";
import { isLicenceActive, LICENCE_INACTIVE_MESSAGE } from "@/lib/compliance/licence";

export type CountryControlFlags = {
  siteAccess: boolean;
  freePlay: boolean;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
};

export type ResolvedFlags = {
  siteAccess: boolean;
  freePlay: boolean;
  deposits: boolean;
  withdrawals: boolean;
  realMoneyRestricted: boolean;
  licenceActive: boolean;
  banner: string | null;
  depositBlockReason: string | null;
  withdrawalBlockReason: string | null;
};

/** Defaults for any country with no admin row: deposits OFF. */
export const UNCONFIGURED_COUNTRY_DEFAULTS: CountryControlFlags = {
  siteAccess: true,
  freePlay: true,
  depositsEnabled: false,
  withdrawalsEnabled: false,
};

export function resolveAccessFlags(
  countryCode: string | null | undefined,
  admin: CountryControlFlags | null | undefined,
  opts: { licenceActive?: boolean } = {},
): ResolvedFlags {
  const licenceActive = opts.licenceActive ?? isLicenceActive();
  const realMoneyRestricted = isRealMoneyRestrictedCountry(countryCode);
  const flags = admin ?? UNCONFIGURED_COUNTRY_DEFAULTS;

  const deposits = licenceActive && !realMoneyRestricted && flags.depositsEnabled;
  const withdrawals = licenceActive && !realMoneyRestricted && flags.withdrawalsEnabled;

  let depositBlockReason: string | null = null;
  if (!licenceActive) depositBlockReason = LICENCE_INACTIVE_MESSAGE;
  else if (realMoneyRestricted) depositBlockReason = REAL_MONEY_RESTRICTED_BANNER;
  else if (!flags.depositsEnabled) depositBlockReason = "Deposits are not enabled for your country.";

  let withdrawalBlockReason: string | null = null;
  if (!licenceActive) withdrawalBlockReason = LICENCE_INACTIVE_MESSAGE;
  else if (realMoneyRestricted) withdrawalBlockReason = REAL_MONEY_RESTRICTED_BANNER;
  else if (!flags.withdrawalsEnabled) withdrawalBlockReason = "Withdrawals are not enabled for your country.";

  return {
    siteAccess: flags.siteAccess,
    freePlay: flags.freePlay,
    deposits,
    withdrawals,
    realMoneyRestricted,
    licenceActive,
    banner: realMoneyRestricted ? REAL_MONEY_RESTRICTED_BANNER : null,
    depositBlockReason,
    withdrawalBlockReason,
  };
}
