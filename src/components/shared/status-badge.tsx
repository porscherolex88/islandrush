import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-gold-foreground",
  danger: "bg-destructive/10 text-destructive",
  gold: "bg-gold-soft text-gold-foreground",
} as const;

export type Tone = keyof typeof TONES;

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  REVIEW: "brand",
  IN_REVIEW: "brand",
  APPROVED: "brand",
  PROCESSING: "brand",
  COMPLETED: "success",
  SETTLED: "success",
  VERIFIED: "success",
  ACTIVE: "success",
  PUBLISHED: "success",
  CLEARED: "success",
  RESOLVED: "success",
  SUCCESS: "success",
  OPEN: "warning",
  HELD: "warning",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
  CLOSED: "neutral",
  CANCELLED: "neutral",
  UNVERIFIED: "neutral",
  RUNNING: "brand",
  REJECTED: "danger",
  REVERSED: "danger",
  SUSPENDED: "danger",
  CONFIRMED: "danger",
  FAILED: "danger",
  HIGH: "danger",
  URGENT: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
  NORMAL: "neutral",
};

export function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function StatusBadge({ status, tone, className, label }: { status: string; tone?: Tone; className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        TONES[tone ?? STATUS_TONE[status] ?? "neutral"],
        className,
      )}
    >
      {label ?? humanize(status)}
    </span>
  );
}

export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}
