"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findUserByEmailAction, setRolePermissionsAction, setUserRoleAction } from "@/server/actions/admin/ops";

const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";

export function RoleSelect({ userId, role, roles, disabled }: { userId: string; role: string; roles: string[]; disabled?: boolean }) {
  const router = useRouter();
  const [next, setNext] = useState(role);
  return (
    <div className="flex items-center gap-2">
      <select value={next} onChange={(e) => setNext(e.target.value)} className={selectCls} disabled={disabled} aria-label="Role">
        {roles.map((r) => (
          <option key={r} value={r}>
            {r.replace("_", " ")}
          </option>
        ))}
      </select>
      {next !== role && (
        <ConfirmDialog
          trigger={<Button size="sm">Save</Button>}
          title={`Change role to ${next.replace("_", " ")}?`}
          description={next === "USER" ? "This removes all admin access immediately." : "The user gains the permissions of this role immediately. You may be asked to sign in again."}
          reasonLabel="Reason"
          destructive={next === "USER"}
          onConfirm={async (reason) => {
            const r = await setUserRoleAction(userId, next, reason);
            if (r.ok) {
              toast.success("Role updated");
              router.refresh();
            } else toast.error(r.error);
            return r;
          }}
        />
      )}
    </div>
  );
}

export function GrantAdminForm({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0]);
  const [found, setFound] = useState<{ id: string; name: string; role: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await findUserByEmailAction(email);
            if (r.ok) setFound(r.data);
            else {
              setFound(null);
              toast.error(r.error);
            }
          });
        }}
      >
        <div className="grid flex-1 gap-1">
          <Label className="text-xs text-muted-foreground">Existing account email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Find
        </Button>
      </form>
      {found && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">
            <span className="font-medium">{found.name}</span> <span className="text-muted-foreground">is currently {found.role.replace("_", " ")}</span>
          </span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls} aria-label="New role">
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
          <ConfirmDialog
            trigger={<Button size="sm">Grant role</Button>}
            title={`Make ${found.name} a ${role.replace("_", " ")}?`}
            description="They get admin access on their next page load."
            reasonLabel="Reason"
            onConfirm={async (reason) => {
              const r = await setUserRoleAction(found.id, role, reason);
              if (r.ok) {
                toast.success("Admin access granted");
                setFound(null);
                setEmail("");
                router.refresh();
              } else toast.error(r.error);
              return r;
            }}
          />
        </div>
      )}
    </div>
  );
}

export function PermissionMatrix({ roles, permissions, granted }: { roles: string[]; permissions: { key: string; label: string }[]; granted: Record<string, string[]> }) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(roles.map((r) => [r, new Set(granted[r] ?? [])])));
  const dirty = (role: string) => {
    const a = state[role];
    const b = new Set(granted[role] ?? []);
    return a.size !== b.size || [...a].some((p) => !b.has(p));
  };
  function toggle(role: string, perm: string) {
    setState((s) => {
      const next = new Set(s[role]);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...s, [role]: next };
    });
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Permission</th>
            {roles.map((r) => (
              <th key={r} className="px-3 py-2.5 text-center font-medium">
                {r.replace("_", " ")}
              </th>
            ))}
            <th className="px-3 py-2.5 text-center font-medium">SUPER ADMIN</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {permissions.map((p) => (
            <tr key={p.key} className="hover:bg-muted/30">
              <td className="px-3 py-2">
                <p className="font-medium">{p.label}</p>
                <code className="text-[11px] text-muted-foreground">{p.key}</code>
              </td>
              {roles.map((r) => (
                <td key={r} className="px-3 py-2 text-center">
                  <input type="checkbox" checked={state[r].has(p.key)} onChange={() => toggle(r, p.key)} className="size-4 accent-[var(--primary)]" aria-label={`${r} ${p.key}`} />
                </td>
              ))}
              <td className="px-3 py-2 text-center">
                <input type="checkbox" checked disabled className="size-4" aria-label={`SUPER_ADMIN ${p.key}`} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t">
          <tr>
            <td className="px-3 py-3 text-xs text-muted-foreground">Super Admin always has every permission.</td>
            {roles.map((r) => (
              <td key={r} className="px-3 py-3 text-center">
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant={dirty(r) ? "default" : "outline"} disabled={!dirty(r)}>
                      Save
                    </Button>
                  }
                  title={`Update ${r.replace("_", " ")} permissions?`}
                  description={`${state[r].size} permissions will apply to every ${r.replace("_", " ").toLowerCase()} immediately.`}
                  reasonLabel="Reason"
                  onConfirm={async (reason) => {
                    const res = await setRolePermissionsAction(r, [...state[r]], reason);
                    if (res.ok) {
                      toast.success("Permissions saved");
                      router.refresh();
                    } else toast.error(res.error);
                    return res;
                  }}
                />
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
