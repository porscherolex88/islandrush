import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { detectFiatDisplay, FIAT_COOKIE, type FiatDisplay } from "@/lib/fiat-display.shared";

export type { FiatDisplay } from "@/lib/fiat-display.shared";
export { FIAT_COOKIE, detectFiatDisplay, usdMyrRate } from "@/lib/fiat-display.shared";

/** Request-scoped display currency (USD default, MYR in Malaysia). */
export const getFiatDisplay = cache(async (): Promise<FiatDisplay> => {
  const c = await cookies();
  const h = await headers();
  return detectFiatDisplay({
    cookie: c.get(FIAT_COOKIE)?.value ?? null,
    country: h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
    acceptLanguage: h.get("accept-language"),
  });
});
