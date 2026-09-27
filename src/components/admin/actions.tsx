"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAction = (...args: any[]) => Promise<ActionResult<any>>;

type ButtonProps = React.ComponentProps<typeof Button>;

export function ActionButton({
  action,
  args = [],
  children,
  success = "Done",
  confirm,
  variant,
  size = "sm",
  className,
  disabled,
  redirectTo,
}: {
  action: AnyAction;
  args?: unknown[];
  children: ReactNode;
  success?: string;
  confirm?: { title: string; description?: ReactNode; reasonLabel?: string; reasonRequired?: boolean; destructive?: boolean; confirmLabel?: string; extra?: ReactNode };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  disabled?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  async function run(reason?: string) {
    const result = await action(...args, ...(confirm ? [reason || null] : []));
    if (result.ok) {
      toast.success(success);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else toast.error(result.error);
    return result;
  }

  if (confirm) {
    return (
      <ConfirmDialog
        trigger={
          <Button variant={variant ?? (confirm.destructive ? "destructive" : "default")} size={size} className={className} disabled={disabled}>
            {children}
          </Button>
        }
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel ?? "Confirm"}
        destructive={confirm.destructive}
        reasonLabel={confirm.reasonLabel}
        reasonRequired={confirm.reasonRequired ?? true}
        onConfirm={(reason) => run(reason)}
      >
        {confirm.extra}
      </ConfirmDialog>
    );
  }
  return (
    <Button variant={variant} size={size} className={className} disabled={disabled || pending} onClick={() => start(async () => void (await run()))}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

export function TextActionForm({
  action,
  args = [],
  label,
  placeholder,
  submitLabel = "Save",
  initial = "",
  success = "Saved",
  multiline = true,
  clearOnSuccess = false,
  extra,
}: {
  action: AnyAction;
  args?: unknown[];
  label: string;
  placeholder?: string;
  submitLabel?: string;
  initial?: string;
  success?: string;
  multiline?: boolean;
  clearOnSuccess?: boolean;
  extra?: (value: string) => unknown[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await action(...args, value, ...(extra ? extra(value) : []));
          if (result.ok) {
            toast.success(success);
            if (clearOnSuccess) setValue("");
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} placeholder={placeholder} maxLength={4000} />
      ) : (
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
