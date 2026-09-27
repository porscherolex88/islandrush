import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { getAuthSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getAuthSession()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/app");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-1 text-muted-foreground">Sign in to continue your adventure.</p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
