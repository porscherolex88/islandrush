/**
 * Global licence gate for real-money deposits and withdrawals.
 *
 * Real-money features stay disabled site-wide until LICENCE_NUMBER is set.
 * When set, LICENCE_NUMBER and LICENSED_ENTITY are shown in the footer and Terms.
 */

export function getLicenceNumber(): string | null {
  const v = process.env.LICENCE_NUMBER?.trim();
  return v ? v : null;
}

export function getLicensedEntity(): string | null {
  const v = process.env.LICENSED_ENTITY?.trim();
  return v ? v : null;
}

/** True when the operator has published a licence number via env. */
export function isLicenceActive(): boolean {
  return Boolean(getLicenceNumber());
}

export function getLicenceDisplay(): { licenceNumber: string; licensedEntity: string | null } | null {
  const licenceNumber = getLicenceNumber();
  if (!licenceNumber) return null;
  return { licenceNumber, licensedEntity: getLicensedEntity() };
}

export const LICENCE_INACTIVE_MESSAGE =
  "Real-money deposits and withdrawals are not available until the platform licence is configured.";
