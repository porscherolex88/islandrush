"use client";

import { useSyncExternalStore } from "react";

const KEY = "lb_country_banner_dismissed";
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot() {
  try {
    return sessionStorage.getItem(KEY) !== "1";
  } catch {
    return true;
  }
}

function getServerSnapshot() {
  return false;
}

function dismissBanner() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
}

export function CountryRestrictedBanner({ message }: { message: string }) {
  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!show) return null;
  return (
    <div role="status" className="mx-4 mb-1 flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-primary">
      <p className="flex-1">{message}</p>
      <button type="button" className="shrink-0 text-xs font-semibold underline" onClick={dismissBanner}>
        Dismiss
      </button>
    </div>
  );
}
