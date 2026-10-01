"use client";

import { Loader2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { maskAccount } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import {
  changePasswordAction,
  requestVerificationAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  updateNotificationPrefsAction,
  updatePlayLimitsAction,
  updateProfileAction,
} from "@/server/actions/account";
import { addWithdrawalAccountAction, archiveWithdrawalAccountAction, setDefaultWithdrawalAccountAction } from "@/server/actions/wallet";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [values, setValues] = useState({ name, phone });
  const { run, pending } = useAction(updateProfileAction, { success: "Profile updated" });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(values);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled className="h-11" />
        <p className="text-xs text-muted-foreground">Contact support to change your email address.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required maxLength={80} className="h-11" autoComplete="name" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" type="tel" value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} placeholder="012 345 6789" className="h-11" autoComplete="tel" />
        <p className="text-xs text-muted-foreground">Needed for account verification.</p>
      </div>
      <Button variant="gold" type="submit" size="pill" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirm: "", revokeOthers: true });
  const { run, pending } = useAction(changePasswordAction, {
    success: "Password changed",
    onSuccess: () => setV({ currentPassword: "", newPassword: "", confirm: "", revokeOthers: true }),
  });
  const mismatch = v.confirm.length > 0 && v.confirm !== v.newPassword;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) run({ currentPassword: v.currentPassword, newPassword: v.newPassword, revokeOthers: v.revokeOthers });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="cur">Current password</Label>
        <Input id="cur" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new">New password</Label>
        <Input id="new" type="password" autoComplete="new-password" minLength={8} value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} required className="h-11" aria-invalid={mismatch} />
        {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match</p>}
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        Sign out other devices
        <Switch checked={v.revokeOthers} onCheckedChange={(c) => setV({ ...v, revokeOthers: c })} />
      </label>
      <Button variant="gold" type="submit" size="pill" className="w-full" disabled={pending || mismatch}>
        {pending && <Loader2 className="animate-spin" />}
        Change password
      </Button>
    </form>
  );
}

export type SessionView = { id: string; token: string; userAgent: string | null; ipAddress: string | null; createdAt: string; current: boolean };

function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return `${browser} on ${os}`;
}

export function SessionList({ sessions }: { sessions: SessionView[] }) {
  const revoke = useAction(revokeSessionAction, { success: "Device signed out" });
  const revokeAll = useAction(revokeOtherSessionsAction, { success: "Other devices signed out" });
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-2xl border bg-card">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {deviceName(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">This device</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Signed in {formatDateTime(s.createdAt)}
                {s.ipAddress ? ` · ${s.ipAddress}` : ""}
              </p>
            </div>
            {!s.current && (
              <Button variant="ghost" size="sm" className="text-destructive" disabled={revoke.pending} onClick={() => revoke.run(s.token)}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && (
        <Button variant="outline" className="w-full" disabled={revokeAll.pending} onClick={() => revokeAll.run()}>
          Sign out all other devices
        </Button>
      )}
    </div>
  );
}

export function RequestVerificationButton({ disabled }: { disabled: boolean }) {
  const { run, pending } = useAction(requestVerificationAction, { success: "Verification requested. We'll be in touch." });
  return (
    <Button variant="gold" size="pill" className="w-full" disabled={disabled || pending} onClick={() => run()}>
      {pending && <Loader2 className="animate-spin" />}
      Request verification
    </Button>
  );
}

type Prefs = { rewards: boolean; missions: boolean; referrals: boolean; system: boolean };

export function NotificationPrefsForm({ prefs }: { prefs: Prefs }) {
  const [v, setV] = useState(prefs);
  const { run, pending } = useAction(updateNotificationPrefsAction, { success: "Preferences saved" });
  const rows: { key: keyof Prefs; label: string; hint: string }[] = [
    { key: "rewards", label: "Rewards and collections", hint: "Big wins, collection completions and streak milestones" },
    { key: "missions", label: "Missions", hint: "When a daily mission is completed" },
    { key: "referrals", label: "Referrals", hint: "New referrals and referral rewards" },
    { key: "system", label: "News and announcements", hint: "Product updates and events" },
  ];
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-2xl border bg-card">
        {rows.map((r) => (
          <li key={r.key}>
            <label className="flex items-center justify-between gap-3 p-4">
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{r.hint}</span>
              </span>
              <Switch checked={v[r.key]} onCheckedChange={(c) => setV({ ...v, [r.key]: c })} />
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Wallet and security notifications are always on.</p>
      <Button variant="gold" size="pill" className="w-full" disabled={pending} onClick={() => run(v)}>
        {pending && <Loader2 className="animate-spin" />}
        Save preferences
      </Button>
    </div>
  );
}

export function PlayLimitsForm({ dailyCreditLimit, onBreak }: { dailyCreditLimit: number | null; onBreak: boolean }) {
  const [limit, setLimit] = useState(dailyCreditLimit ? String(dailyCreditLimit) : "");
  const save = useAction(updatePlayLimitsAction, { success: "Daily limit saved" });
  const takeBreak = useAction(updatePlayLimitsAction, { success: "Play break started" });
  const parsed = limit ? Number(limit.replace(/\D/g, "")) : null;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="limit" className="text-base font-bold">
          Daily Credit limit
        </Label>
        <p className="text-sm text-muted-foreground">The most Credits you can spend on games per day. Leave empty for no limit.</p>
        <Input id="limit" inputMode="numeric" placeholder="No limit" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))} className="h-11" />
        <Button variant="gold" className="w-full" size="pill" disabled={save.pending} onClick={() => save.run({ dailyCreditLimit: parsed, breakDays: null })}>
          {save.pending && <Loader2 className="animate-spin" />}
          Save limit
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-base font-bold">Take a break</p>
        <p className="text-sm text-muted-foreground">Pause all games for a while. Once started, a break can&apos;t be shortened. Your wallet and withdrawals stay available.</p>
        <div className="grid grid-cols-3 gap-2">
          {[1, 7, 30].map((d) => (
            <ConfirmDialog
              key={d}
              trigger={
                <Button variant="outline" size="pill" disabled={takeBreak.pending || onBreak}>
                  {d} day{d > 1 ? "s" : ""}
                </Button>
              }
              title={`Take a ${d}-day break?`}
              description="Games will be paused until the break ends. This can't be undone early."
              confirmLabel="Start break"
              onConfirm={() => takeBreak.run({ dailyCreditLimit: dailyCreditLimit, breakDays: d })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type Account = { id: string; bankName: string; accountName: string; accountNumber: string; isDefault: boolean };

const BANKS = ["Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank", "AmBank", "Bank Islam", "Bank Rakyat", "BSN", "OCBC Bank", "UOB Malaysia", "HSBC Malaysia", "Standard Chartered", "Alliance Bank", "Affin Bank"];

export function WithdrawalAccounts({ accounts, defaultName }: { accounts: Account[]; defaultName: string }) {
  const [form, setForm] = useState({ bankName: BANKS[0], accountName: defaultName, accountNumber: "" });
  const add = useAction(addWithdrawalAccountAction, { success: "Bank account added", onSuccess: () => setForm((f) => ({ ...f, accountNumber: "" })) });
  const archive = useAction(archiveWithdrawalAccountAction, { success: "Bank account removed" });
  const setDefault = useAction(setDefaultWithdrawalAccountAction, { success: "Default account updated" });
  return (
    <div className="space-y-5">
      {accounts.length > 0 && (
        <ul className="divide-y rounded-2xl border bg-card">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {a.bankName} {a.isDefault && <span className="ml-1 text-[10px] font-bold text-primary">Default</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.accountName} · {maskAccount(a.accountNumber)}
                </p>
              </div>
              {!a.isDefault && (
                <Button variant="ghost" size="icon-lg" aria-label="Make default" onClick={() => setDefault.run(a.id)} disabled={setDefault.pending}>
                  <Star />
                </Button>
              )}
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-lg" aria-label="Remove account" className="text-destructive">
                    <Trash2 />
                  </Button>
                }
                title="Remove this bank account?"
                description={`${a.bankName} ${maskAccount(a.accountNumber)} will no longer be available for withdrawals.`}
                confirmLabel="Remove"
                destructive
                onConfirm={() => archive.run(a.id)}
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="space-y-3 rounded-2xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.run(form);
        }}
      >
        <p className="font-semibold">Add a bank account</p>
        <div className="grid gap-1.5">
          <Label htmlFor="bank">Bank</Label>
          <select id="bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="h-11 rounded-lg border bg-background px-3 text-sm">
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="acct-name">Account holder name</Label>
          <Input id="acct-name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} required className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="acct-no">Account number</Label>
          <Input id="acct-no" inputMode="numeric" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/[^\d ]/g, "") })} required className="h-11 font-mono" />
        </div>
        <p className="text-xs text-muted-foreground">The account must be in your own name. Payouts to third-party accounts are rejected.</p>
        <Button variant="gold" type="submit" size="pill" className="w-full" disabled={add.pending}>
          {add.pending && <Loader2 className="animate-spin" />}
          Add account
        </Button>
      </form>
    </div>
  );
}
