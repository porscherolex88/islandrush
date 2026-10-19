import { getAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const routes = () => getAuth().handler();

export async function GET(request: Request) {
  return routes().GET(request);
}

export async function POST(request: Request) {
  return routes().POST(request);
}
