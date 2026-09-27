import type { ReactNode } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { FieldDef } from "@/lib/admin/resource-fields";
import { formatCredits, formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export function formatCell(field: FieldDef | undefined, name: string, value: unknown, labels: Record<string, Record<string, string>>): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">-</span>;
  if (value instanceof Date) return <span className="whitespace-nowrap text-xs">{formatDateTime(value)}</span>;
  if (!field) return typeof value === "object" ? JSON.stringify(value) : String(value);
  switch (field.type) {
    case "boolean":
      return value ? <StatusBadge status="ACTIVE" label="Yes" /> : <StatusBadge status="DRAFT" label="No" />;
    case "select":
      return name === "status" ? <StatusBadge status={String(value)} /> : <span className="text-xs font-medium">{String(value).replace(/_/g, " ")}</span>;
    case "money":
      return <span className="tabular">{name === "amount" || name === "value" ? String(value) : formatMYR(String(value))}</span>;
    case "credits":
      return <span className="tabular">{formatCredits(Number(value))}</span>;
    case "relation":
      return labels[field.relation!]?.[String(value)] ?? String(value).slice(0, 8);
    case "color":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border" style={{ background: String(value) }} /> {String(value)}
        </span>
      );
    case "list":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "json":
      return <code className="text-xs">{JSON.stringify(value).slice(0, 60)}</code>;
    default:
      return <span className="line-clamp-2">{String(value)}</span>;
  }
}
