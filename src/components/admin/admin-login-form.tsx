"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminChangePasswordAction, adminSignInAction, type AdminAuthState } from "@/server/actions/admin-auth";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminSignInAction, {} as AdminAuthState);
  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-5">
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoComplete="username" required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
      </div>
      <Button type="submit" variant="gold" size="pill" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

export function AdminChangePasswordForm() {
  const [state, action, pending] = useActionState(adminChangePasswordAction, {} as AdminAuthState);
  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-5">
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} className="h-11" />
      </div>
      <Button type="submit" variant="gold" size="pill" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Save and continue
      </Button>
    </form>
  );
}
