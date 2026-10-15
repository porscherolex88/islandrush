/** Server-side age checks for signup (18+). */

/** Returns age in full years on `asOf` (UTC date parts), or null if the DOB is invalid / in the future. */
export function ageYears(dateOfBirth: string | Date, asOf: Date = new Date()): number | null {
  const dob = typeof dateOfBirth === "string" ? parseIsoDate(dateOfBirth) : dateOfBirth;
  if (!dob) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const month = asOf.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && asOf.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

export function isAtLeast18(dateOfBirth: string | Date, asOf: Date = new Date()) {
  const age = ageYears(dateOfBirth, asOf);
  return age !== null && age >= 18;
}

/** Parse YYYY-MM-DD into a UTC Date at midnight. Rejects impossible calendar dates. */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
