import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminContext } from "@/lib/auth/admin-session";
import { COMPANY_NAME } from "@/lib/company";
import { bootstrapAdminFromEnv } from "@/server/services/admin-auth";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  await bootstrapAdminFromEnv();
  const ctx = await getAdminContext();
  if (ctx && !ctx.admin.mustChangePassword) redirect("/admin");
  if (ctx?.admin.mustChangePassword) redirect("/admin/change-password");

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Staff only</p>
          <h1 className="mt-1 font-heading text-2xl font-bold">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">{COMPANY_NAME}</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
