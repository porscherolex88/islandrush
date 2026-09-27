import { getAdminContext, getCurrentUser } from "@/lib/auth/session";
import { getFile } from "@/server/services/files";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const file = await getFile(id);
  if (!file) return new Response("Not found", { status: 404 });
  if (file.ownerId !== user.id) {
    const admin = await getAdminContext();
    if (!admin?.can("finance.view")) return new Response("Not found", { status: 404 });
  }

  const ext = file.mimeType === "application/pdf" ? "pdf" : file.mimeType.split("/")[1];
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="proof-${file.id.slice(0, 8)}.${ext}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
