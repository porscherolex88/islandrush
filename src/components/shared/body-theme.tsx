"use client";

import { useEffect } from "react";

/** Mirrors a theme class onto <body> so portalled dialogs, sheets and toasts use the same palette. */
export function BodyTheme({ className }: { className: string }) {
  useEffect(() => {
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [className]);
  return null;
}
