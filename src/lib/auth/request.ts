import "server-only";
import { cookies, headers } from "next/headers";

export const DEVICE_COOKIE = "lb_did";
export const REFERRAL_COOKIE = "lb_ref";

export async function getRequestMeta() {
  const h = await headers();
  const c = await cookies();
  const forwarded = h.get("x-forwarded-for");
  const countryRaw = (h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "").trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(countryRaw) && countryRaw !== "XX" && countryRaw !== "T1" ? countryRaw : null;
  return {
    ip: forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
    deviceId: c.get(DEVICE_COOKIE)?.value ?? null,
    referralCode: c.get(REFERRAL_COOKIE)?.value ?? null,
    country,
  };
}
