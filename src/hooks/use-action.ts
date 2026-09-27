"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

type Options<T> = {
  success?: string | ((data: T) => string | null);
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  refresh?: boolean;
};

/** Runs a server action with pending state, toast feedback and an optional router refresh. */
export function useAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>, opts: Options<T> = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (...args: A) =>
      new Promise<ActionResult<T>>((resolve) => {
        setError(null);
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action(...args);
          } catch {
            result = { ok: false, error: "Connection problem. Check your internet and try again." };
          }
          if (result.ok) {
            const msg = typeof opts.success === "function" ? opts.success(result.data) : opts.success;
            if (msg) toast.success(msg);
            opts.onSuccess?.(result.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            setError(result.error);
            toast.error(result.error);
            opts.onError?.(result.error);
          }
          resolve(result);
        });
      }),
    [action, opts, router],
  );

  return { run, pending, error };
}

export function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
