import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminChangePasswordForm } from "@/components/admin/admin-login-form";
import { requireAdminAllowPasswordChange } from "@/lib/auth/admin-session";

export const metadata: Metadata = {
  title: "Change password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminChangePasswordPage() {
  const ctx = await requireAdminAllowPasswordChange();
  if (!ctx.admin.mustChangePassword) redirect("/admin");

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">You must change the bootstrap password before using the admin console.</p>
        </div>
        <AdminChangePasswordForm />
      </div>
    </div>
  );
}
