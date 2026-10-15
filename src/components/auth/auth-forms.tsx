"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminSignInAction,
  forgotPasswordAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/server/actions/auth";

function PasswordInput({ id, autoComplete, minLength }: { id: string; autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name="password" type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} className="h-12 pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormError({ state }: { state: AuthFormState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {state.error}
    </p>
  );
}

function FormSuccess({ state }: { state: AuthFormState }) {
  if (!state.success) return null;
  return (
    <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
      {state.success}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={state.fields?.phone}
          placeholder="012 345 6789"
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">Existing email accounts can still sign in with their email address here.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="current-password" />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to LootBox?{" "}
        <Link href="/register" className="font-semibold text-primary">
          Create an account
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Forgot your password?{" "}
        <Link href="/forgot-password" className="font-semibold text-primary underline">
          Request a reset
        </Link>
      </p>
    </form>
  );
}

export function AdminLoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(adminSignInAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          defaultValue={state.fields?.username}
          className="h-12"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="current-password" />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm({ referralCode }: { referralCode?: string }) {
  const [state, action, pending] = useActionState(signUpAction, {});
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={state.fields?.name} className="h-12" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={state.fields?.phone}
          placeholder="012 345 6789"
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">This is how you sign in. No SMS code is sent.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={state.fields?.dateOfBirth} className="h-12" max={new Date().toISOString().slice(0, 10)} />
        <p className="text-xs text-muted-foreground">You must be 18 or older. We check this when you create your account.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" autoComplete="new-password" minLength={8} />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="referralCode">Referral code (optional)</Label>
        <Input
          id="referralCode"
          name="referralCode"
          defaultValue={state.fields?.referralCode ?? referralCode ?? ""}
          maxLength={12}
          className="h-12 font-mono tracking-widest"
          autoCapitalize="characters"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span className="text-muted-foreground">
          I agree to the{" "}
          <Link href="/terms" className="font-semibold text-primary underline" target="_blank">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-primary underline" target="_blank">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  if (state.success) {
    return (
      <div className="space-y-4">
        <FormSuccess state={state} />
        <Button asChild variant="outline" size="xl" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <div className="grid gap-1.5">
        <Label htmlFor="phoneOrName">Phone number or username</Label>
        <Input
          id="phoneOrName"
          name="phoneOrName"
          required
          defaultValue={state.fields?.phoneOrName}
          placeholder="012 345 6789 or your name"
          className="h-12"
          autoComplete="username"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="message">How can we help?</Label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          defaultValue={state.fields?.message}
          placeholder="I can't sign in and need a password reset."
          className="min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">Support will verify your account in the admin queue before resetting anything. Never share your password.</p>
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Send request
      </Button>
    </form>
  );
}
