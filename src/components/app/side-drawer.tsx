"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DrawerContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

/**
 * Left "push" drawer for the user app. The panel slides in from the left while the page
 * slides right and zooms out to 90%, staying visible behind a dim overlay, and the bottom
 * nav (`nav`) slides down out of view.
 * The page only carries a transform while the drawer is open, because a transform turns
 * the wrapper into the containing block for any `position: fixed` content inside it.
 */
export function PushDrawerFrame({ drawer, nav, children }: { drawer: ReactNode; nav?: ReactNode; children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [originY, setOriginY] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);

  const setOpen = useCallback((next: boolean) => {
    if (next) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      const el = page.current;
      if (el) setOriginY(window.innerHeight / 2 - el.getBoundingClientRect().top);
    }
    setOpenState(next);
  }, []);

  useEffect(() => {
    if (!open) {
      returnFocus.current?.focus();
      return;
    }
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    // A sheet opened from inside the drawer handles its own Escape first.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[data-slot="sheet-content"]') && setOpenState(false);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeOnNavigate = (e: MouseEvent) => {
    if ((e.target as Element).closest("a")) setOpenState(false);
  };

  return (
    <DrawerContext.Provider value={{ open, setOpen }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        onClick={closeOnNavigate}
        className={cn(
          "fixed inset-y-0 left-[max(0px,calc(50vw-215px))] z-50 w-(--drawer-w) overflow-y-auto overscroll-contain rounded-r-lg bg-background transition-[translate,visibility] duration-300 ease-out desktop:absolute desktop:left-0 motion-reduce:transition-none",
          open ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        {drawer}
      </div>
      <div
        ref={page}
        style={{ transformOrigin: `0 ${originY}px` }}
        className={cn(
          "relative flex flex-1 flex-col transition-[translate,scale] duration-300 ease-out desktop:min-h-0 motion-reduce:transition-none",
          open && "translate-x-(--drawer-w) scale-90",
        )}
      >
        <div className="contents" inert={open}>
          {children}
        </div>
      </div>
      <div inert={open} className={cn("sticky bottom-0 z-30 transition-[translate] duration-300 ease-out motion-reduce:transition-none", open && "translate-y-full")}>
        {nav}
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => setOpenState(false)}
        className={cn("fixed inset-0 z-40 bg-foreground/25 transition-opacity duration-300 desktop:absolute", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
    </DrawerContext.Provider>
  );
}

export function DrawerClose({ className }: { className?: string }) {
  const ctx = useContext(DrawerContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(false)}
      aria-label="Close menu"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border bg-card transition-colors hover:bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <X className="size-5" aria-hidden />
    </button>
  );
}

export function DrawerTrigger({ children, className, label = "Open menu" }: { children: ReactNode; className?: string; label?: string }) {
  const ctx = useContext(DrawerContext);
  return (
    <button type="button" onClick={() => ctx?.setOpen(true)} aria-label={label} aria-expanded={ctx?.open ?? false} aria-haspopup="dialog" className={className}>
      {children}
    </button>
  );
}
