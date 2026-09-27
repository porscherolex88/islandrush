import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { navForPermissions } from "@/lib/admin/nav";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | LootBox Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const ctx = await requireAdmin();
  const nav = navForPermissions(ctx.can);
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r bg-background lg:block">
        <Suspense>
          <AdminSidebar nav={nav} />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <AdminHeader nav={nav} user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.role }} />
        <main className="mx-auto max-w-[1400px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
