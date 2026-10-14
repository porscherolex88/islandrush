import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/auth/auth-forms";
import { Logo } from "@/components/shared/logo";
import { getAdminContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin") ? sp.next : undefined;
  if (await getAdminContext()) redirect(next ?? "/admin");
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-5 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border bg-background p-6 sm:p-8">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your staff username and password.</p>
        </div>
        <AdminLoginForm next={next} />
      </div>
    </div>
  );
}
