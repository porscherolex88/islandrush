import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Token } from "./art";

export type RequirementView = {
  id: string;
  label: string;
  icon: string;
  current: number;
  required: number;
  met: boolean;
  consume: boolean;
};

export function RequirementList({ requirements, className, tone = "light" }: { requirements: RequirementView[]; className?: string; tone?: "light" | "dark" }) {
  return (
    <ul className={cn("space-y-2", className)}>
      {requirements.map((r) => {
        const shown = Math.min(r.current, r.required);
        return (
          <li
            key={r.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3",
              tone === "dark" ? "border-white/10 bg-white/5" : "bg-card",
              r.met && (tone === "dark" ? "border-emerald-300/30 bg-emerald-400/10" : "border-success/30 bg-success-soft/50"),
            )}
          >
            <Token icon={r.icon} owned={r.current > 0} rarity={r.met ? "UNCOMMON" : "COMMON"} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{r.label}</p>
                <span className="font-heading text-base font-extrabold tabular">
                  {shown} / {r.required}
                </span>
              </div>
              <Progress value={(shown / Math.max(1, r.required)) * 100} className={cn("mt-1.5 h-1.5", tone === "dark" && "bg-white/10")} indicatorClassName={r.met ? "bg-success" : "bg-amber-500"} aria-label={r.label} />
              {r.consume && <p className={cn("mt-1 text-[11px]", tone === "dark" ? "text-white/60" : "text-muted-foreground")}>Used up when unlocking</p>}
            </div>
            {r.met && (
              <span className="grid size-7 place-items-center rounded-full bg-success text-white" aria-label="Requirement met">
                <Check className="size-4" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
