import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { getAuthSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  if (await getAuthSession()) redirect("/account/security");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Forgot password</h1>
        <p className="mt-1 text-muted-foreground">Send a request to support. We will verify your account and help you get back in.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}
