/** Malaysian mobile/landline helpers for phone-as-login (no SMS verification). */

const DIGITS = /^\d+$/;

/** Strip spaces, dashes and parentheses. Keep a leading + if present. */
export function stripPhone(raw: string) {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalize a Malaysian phone number to E.164 (+60...).
 * Accepts 01x..., 60..., +60..., and spaced/dashed forms.
 */
export function normalizeMyPhone(raw: string): string | null {
  let digits = stripPhone(raw).replace(/^\+/, "");
  if (!digits || !DIGITS.test(digits)) return null;
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  if (!digits.startsWith("60")) return null;
  // MY mobile: 60 + 9-10 subscriber digits; landline similar length.
  if (digits.length < 11 || digits.length > 12) return null;
  return `+${digits}`;
}

/** Display form for Malaysian numbers, e.g. 012 345 6789. */
export function formatMyPhone(e164: string) {
  const digits = e164.replace(/^\+60/, "0").replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Synthetic Neon Auth email for phone-first accounts (never shown as a contact email). */
export function phoneAuthEmail(e164: string) {
  return `p.${e164.replace(/\D/g, "")}@phone.lootbox.internal`;
}

export function isPhoneAuthEmail(email: string) {
  return email.toLowerCase().endsWith("@phone.lootbox.internal");
}

/** True when the string looks like an email rather than a phone login. */
export function looksLikeEmail(value: string) {
  return value.includes("@");
}
