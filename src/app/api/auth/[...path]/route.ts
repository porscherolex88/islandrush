import { getAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().POST(request, context);
}
