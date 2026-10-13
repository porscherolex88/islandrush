import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sticky header with a solid background at all times. */
export function ScrollFadeHeader({
  children,
  className,
  tint = "var(--background)",
  as: Tag = "header",
}: {
  children: ReactNode;
  className?: string;
  /** Background color. */
  tint?: string;
  as?: "header" | "div";
}) {
  return (
    <Tag className={cn("sticky top-0 isolate", className)} style={{ backgroundColor: tint }}>
      {children}
    </Tag>
  );
}
