import { describe, expect, it } from "vitest";
import { ageYears, isAtLeast18, parseIsoDate } from "@/lib/age";
import { formatMyPhone, isPhoneAuthEmail, normalizeMyPhone, phoneAuthEmail } from "@/lib/phone";

describe("normalizeMyPhone", () => {
  it("accepts common Malaysian forms", () => {
    expect(normalizeMyPhone("012 345 6789")).toBe("+60123456789");
    expect(normalizeMyPhone("+60123456789")).toBe("+60123456789");
    expect(normalizeMyPhone("60123456789")).toBe("+60123456789");
    expect(normalizeMyPhone("012-345-6789")).toBe("+60123456789");
  });

  it("rejects non-MY and short numbers", () => {
    expect(normalizeMyPhone("555-1234")).toBeNull();
    expect(normalizeMyPhone("+14155552671")).toBeNull();
    expect(normalizeMyPhone("")).toBeNull();
  });
});

describe("phone auth email", () => {
  it("round-trips as an internal identifier", () => {
    const email = phoneAuthEmail("+60123456789");
    expect(email).toBe("p.60123456789@phone.lootbox.internal");
    expect(isPhoneAuthEmail(email)).toBe(true);
    expect(isPhoneAuthEmail("demo@lootbox.my")).toBe(false);
    expect(formatMyPhone("+60123456789")).toBe("012 345 6789");
  });
});

describe("age check", () => {
  it("requires 18+", () => {
    const asOf = new Date("2026-10-14T12:00:00Z");
    expect(isAtLeast18("2008-10-14", asOf)).toBe(true);
    expect(isAtLeast18("2008-10-15", asOf)).toBe(false);
    expect(isAtLeast18("2000-01-01", asOf)).toBe(true);
    expect(ageYears("2008-10-14", asOf)).toBe(18);
    expect(parseIsoDate("2026-02-30")).toBeNull();
  });
});
