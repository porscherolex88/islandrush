import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type RequirementView = {
  id: string;
  label: string;
  icon: string;
  current: number;
  required: number;
  met: boolean;
  consume: boolean;
};

export function RequirementList({ requirements, className }: { requirements: RequirementView[]; className?: string }) {
  return (
    <ul className={cn("space-y-2", className)}>
      {requirements.map((r) => {
        const shown = Math.min(r.current, r.required);
        return (
          <li key={r.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-2.5", r.met && "border-success/30 bg-success-soft/40")}>
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-xl" aria-hidden>
              {r.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <span className="text-xs font-semibold text-muted-foreground tabular">
                  {shown}/{r.required}
                </span>
              </div>
              <Progress value={(shown / Math.max(1, r.required)) * 100} className="mt-1 h-1.5" indicatorClassName={r.met ? "bg-success" : undefined} aria-label={r.label} />
              {r.consume && <p className="mt-0.5 text-[11px] text-muted-foreground">Used up when unlocking</p>}
            </div>
            {r.met && (
              <span className="grid size-6 place-items-center rounded-full bg-success text-white" aria-label="Requirement met">
                <Check className="size-3.5" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
