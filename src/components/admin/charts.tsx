import type { ReactNode } from "react";
import { AdminCard } from "./ui";

export type Point = { label: string; value: number };

export function BarChart({ data, height = 160, format = (n: number) => n.toLocaleString("en-MY"), color = "var(--primary)" }: { data: Point[]; height?: number; format?: (n: number) => string; color?: string }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">No data for this range</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Bar chart">
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return (
            <rect key={i} x={i * w + w * 0.15} y={height / 4 - h} width={w * 0.7} height={Math.max(h, d.value > 0 ? 0.4 : 0)} rx={0.6} fill={color} opacity={0.85}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function HBarList({ data, format = (n: number) => n.toLocaleString("en-MY") }: { data: (Point & { sub?: string; color?: string })[]; format?: (n: number) => string }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-muted-foreground">No data</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate">{d.label}</span>
            <span className="font-medium tabular">
              {format(d.value)}
              {d.sub && <span className="ml-1 text-xs text-muted-foreground">{d.sub}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? "var(--primary)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <AdminCard title={title} description={description} actions={actions}>
      {children}
    </AdminCard>
  );
}
