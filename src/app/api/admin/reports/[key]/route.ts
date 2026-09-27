import { db } from "@/db";
import { getAdminContext } from "@/lib/auth/session";
import { parseRange, rows } from "@/server/admin/queries";
import { csvLine, getReport, reportPage } from "@/server/admin/reports";
import { audit } from "@/server/services/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHUNK = 2000;
const MAX_ROWS = 500_000;

export async function GET(req: Request, ctx: RouteContext<"/api/admin/reports/[key]">) {
  const { key } = await ctx.params;
  const admin = await getAdminContext();
  if (!admin || !admin.can("reports.view")) return new Response("Forbidden", { status: 403 });
  const def = getReport(key);
  if (!def) return new Response("Unknown report", { status: 404 });
  if (!admin.can(def.permission)) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const range = parseRange(Object.fromEntries(url.searchParams));
  const status = url.searchParams.get("status") ?? undefined;
  await audit(db, {
    actorId: admin.user.id,
    actorRole: admin.role,
    action: "report.export",
    entityType: "report",
    entityId: def.key,
    after: { from: range.from, to: range.to, status: status ?? null },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`\uFEFF${csvLine(def.columns.map((c) => c.label))}`));
        for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
          const chunk = await rows<Record<string, unknown>>(reportPage(def, range, { status }, CHUNK, offset));
          if (chunk.length) controller.enqueue(encoder.encode(chunk.map((r) => csvLine(def.columns.map((c) => r[c.key]))).join("")));
          if (chunk.length < CHUNK) break;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lootbox-${def.key}-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
