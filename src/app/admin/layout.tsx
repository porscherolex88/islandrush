import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | LootBox Admin" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Root admin shell: login/change-password stay public (staff cookie). Console routes add auth in (console)/layout. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
