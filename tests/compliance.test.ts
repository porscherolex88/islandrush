import { afterEach, describe, expect, it } from "vitest";
import { isLicenceActive, LICENCE_INACTIVE_MESSAGE } from "@/lib/compliance/licence";
import {
  isRealMoneyRestrictedCountry,
  REAL_MONEY_RESTRICTED_BANNER,
  RESTRICTED_REAL_MONEY_COUNTRIES,
} from "@/lib/compliance/restricted-countries";
import { resolveAccessFlags } from "@/lib/compliance/resolve-access";

const ORIG_LICENCE = process.env.LICENCE_NUMBER;

afterEach(() => {
  if (ORIG_LICENCE === undefined) delete process.env.LICENCE_NUMBER;
  else process.env.LICENCE_NUMBER = ORIG_LICENCE;
});

describe("restricted real-money countries", () => {
  it("includes the operator list and FATF blacklist", () => {
    for (const c of ["MY", "SG", "US", "GB", "KP", "IR", "MM"]) {
      expect(isRealMoneyRestrictedCountry(c)).toBe(true);
    }
    expect(RESTRICTED_REAL_MONEY_COUNTRIES).toContain("MY");
    expect(isRealMoneyRestrictedCountry("PH")).toBe(false);
    expect(isRealMoneyRestrictedCountry(null)).toBe(false);
  });
});

describe("licence gate", () => {
  it("is inactive when LICENCE_NUMBER is unset", () => {
    delete process.env.LICENCE_NUMBER;
    expect(isLicenceActive()).toBe(false);
  });

  it("is active only when LICENCE_NUMBER is set", () => {
    process.env.LICENCE_NUMBER = "CUR-TEST-1";
    expect(isLicenceActive()).toBe(true);
  });
});

describe("resolveAccessFlags", () => {
  it("keeps deposits off for unconfigured countries even with a licence", () => {
    const r = resolveAccessFlags("PH", null, { licenceActive: true });
    expect(r.deposits).toBe(false);
    expect(r.depositBlockReason).toMatch(/not enabled/i);
  });

  it("blocks deposits and withdrawals without a licence", () => {
    const r = resolveAccessFlags("PH", { siteAccess: true, freePlay: true, depositsEnabled: true, withdrawalsEnabled: true }, { licenceActive: false });
    expect(r.deposits).toBe(false);
    expect(r.withdrawals).toBe(false);
    expect(r.depositBlockReason).toBe(LICENCE_INACTIVE_MESSAGE);
  });

  it("hard-locks restricted countries even if admin enables deposits", () => {
    const r = resolveAccessFlags(
      "MY",
      { siteAccess: true, freePlay: true, depositsEnabled: true, withdrawalsEnabled: true },
      { licenceActive: true },
    );
    expect(r.realMoneyRestricted).toBe(true);
    expect(r.deposits).toBe(false);
    expect(r.withdrawals).toBe(false);
    expect(r.freePlay).toBe(true);
    expect(r.banner).toBe(REAL_MONEY_RESTRICTED_BANNER);
  });

  it("allows deposits when licence is active, country is allowed, and admin enabled them", () => {
    const r = resolveAccessFlags(
      "PH",
      { siteAccess: true, freePlay: true, depositsEnabled: true, withdrawalsEnabled: true },
      { licenceActive: true },
    );
    expect(r.deposits).toBe(true);
    expect(r.withdrawals).toBe(true);
    expect(r.depositBlockReason).toBeNull();
  });
});
