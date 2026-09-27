import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/auth-forms";
import { REFERRAL_COOKIE } from "@/lib/auth/request";
import { getRealAuthSession } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/server/services/config";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  if (await getRealAuthSession()) redirect("/app");
  const [sp, jar, open] = await Promise.all([searchParams, cookies(), isFeatureEnabled("registrations")]);
  const ref = (typeof sp.ref === "string" ? sp.ref : jar.get(REFERRAL_COOKIE)?.value)?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="mt-1 text-muted-foreground">Free to join. Daily check-in and spin from day one.</p>
      </div>
      {open ? (
        <RegisterForm referralCode={ref} />
      ) : (
        <p className="rounded-xl bg-muted p-4 text-sm">New registrations are paused right now. Please check back soon.</p>
      )}
    </div>
  );
}
