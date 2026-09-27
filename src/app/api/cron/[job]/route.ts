import { timingSafeEqual } from "node:crypto";
import { JOBS, runJob, type JobName } from "@/server/services/jobs";

export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { job } = await ctx.params;
  if (!(job in JOBS)) return Response.json({ error: "Unknown job" }, { status: 404 });
  const result = await runJob(job as JobName, "cron");
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
