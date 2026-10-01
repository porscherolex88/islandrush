"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { readFiatCookieClient, type FiatDisplay } from "@/lib/fiat-display.shared";
import { formatCash } from "@/lib/money";

const FiatCurrencyContext = createContext<FiatDisplay>("USD");

export function FiatCurrencyProvider({ currency, children }: { currency: FiatDisplay; children: ReactNode }) {
  return <FiatCurrencyContext.Provider value={currency}>{children}</FiatCurrencyContext.Provider>;
}

export function useFiatCurrency(): FiatDisplay {
  const fromServer = useContext(FiatCurrencyContext);
  const fromCookie = readFiatCookieClient();
  return fromCookie ?? fromServer;
}

export function useFormatCash() {
  const currency = useFiatCurrency();
  return useMemo(
    () =>
      (value: string | bigint, opts: { sign?: boolean } = {}) =>
        formatCash(value, { currency, sign: opts.sign }),
    [currency],
  );
}
