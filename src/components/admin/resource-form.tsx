"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDef, RelationKey } from "@/lib/admin/resource-fields";
import { cn } from "@/lib/utils";
import { deleteResourceAction, saveResourceAction } from "@/server/actions/admin/resources";

type Option = { value: string; label: string };
type Values = Record<string, unknown>;

function toInput(f: FieldDef, v: unknown): string | boolean {
  if (f.type === "boolean") return v === undefined || v === null ? Boolean(f.default) : Boolean(v);
  if (v === undefined || v === null) {
    if (f.default === undefined || f.default === null) return "";
    v = f.default;
  }
  if (f.type === "json") return JSON.stringify(v, null, 2);
  if (f.type === "list") return Array.isArray(v) ? v.join("\n") : String(v);
  if (f.type === "datetime") {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
}

export function ResourceForm({
  resourceKey,
  singular,
  fields,
  id,
  initial,
  options,
  significant,
  deletable,
  afterSave,
  afterDelete,
  preset = {},
}: {
  resourceKey: string;
  singular: string;
  fields: FieldDef[];
  id: string | null;
  initial: Values | null;
  options: Partial<Record<RelationKey, Option[]>>;
  significant?: boolean;
  deletable?: boolean;
  afterSave: string;
  afterDelete: string;
  preset?: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, toInput(f, initial?.[f.name] ?? preset[f.name])])),
  );
  const [pending, start] = useTransition();
  const set = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));

  async function save(reason: string | null) {
    const payload: Values = { ...values };
    for (const f of fields) if (f.type === "datetime" && values[f.name]) payload[f.name] = new Date(String(values[f.name])).toISOString();
    const result = await saveResourceAction(resourceKey, id, payload, reason);
    if (result.ok) {
      toast.success(`${singular} saved`);
      router.push(afterSave.replace(":id", result.data.id));
      router.refresh();
    } else toast.error(result.error);
    return result;
  }

  const submit = (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {id ? "Save changes" : `Create ${singular.toLowerCase()}`}
    </Button>
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!significant) start(async () => void (await save(null)));
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => {
          const locked = Boolean(id && f.immutable);
          const idAttr = `f-${f.name}`;
          const v = values[f.name];
          const wide = f.wide || f.type === "textarea" || f.type === "json" || f.type === "list";
          return (
            <div key={f.name} className={cn("grid content-start gap-1.5", wide && "md:col-span-2")}>
              {f.type === "boolean" ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                  <Label htmlFor={idAttr}>{f.label}</Label>
                  <Switch id={idAttr} checked={Boolean(v)} onCheckedChange={(c) => set(f.name, c)} />
                </div>
              ) : (
                <>
                  <Label htmlFor={idAttr}>
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  {f.type === "select" || f.type === "relation" ? (
                    <select
                      id={idAttr}
                      value={String(v)}
                      onChange={(e) => set(f.name, e.target.value)}
                      disabled={locked}
                      className="h-9 rounded-md border bg-background px-2.5 text-sm"
                    >
                      {(!f.required || f.type === "relation") && <option value="">{f.required ? "Select..." : "None"}</option>}
                      {(f.type === "select" ? (f.options ?? []).map((o) => ({ value: o, label: o.replace(/_/g, " ") })) : options[f.relation!] ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" || f.type === "json" || f.type === "list" ? (
                    <Textarea
                      id={idAttr}
                      value={String(v)}
                      onChange={(e) => set(f.name, e.target.value)}
                      rows={f.type === "textarea" && f.wide ? 12 : f.type === "json" ? 4 : 3}
                      className={cn(f.type === "json" && "font-mono text-xs")}
                      disabled={locked}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      {f.type === "color" && <span className="size-9 shrink-0 rounded-md border" style={{ background: String(v) }} aria-hidden />}
                      <Input
                        id={idAttr}
                        value={String(v)}
                        onChange={(e) => set(f.name, e.target.value)}
                        disabled={locked}
                        type={f.type === "number" || f.type === "credits" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
                        inputMode={f.type === "money" ? "decimal" : undefined}
                        step={f.type === "number" || f.type === "credits" ? 1 : undefined}
                      />
                    </div>
                  )}
                </>
              )}
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {significant ? (
          <ConfirmDialog
            trigger={
              <Button type="button">
                {id ? "Save changes" : `Create ${singular.toLowerCase()}`}
              </Button>
            }
            title={`${id ? "Save" : "Create"} ${singular.toLowerCase()}?`}
            description="This affects the live economy. The old and new values are recorded in the audit log."
            reasonLabel="Reason for change"
            confirmLabel="Save"
            onConfirm={(reason) => save(reason)}
          />
        ) : (
          submit
        )}
        {id && deletable && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" className="text-destructive">
                <Trash2 /> Delete
              </Button>
            }
            title={`Delete this ${singular.toLowerCase()}?`}
            description="Deletion is permanent and recorded in the audit log."
            destructive
            reasonLabel={significant ? "Reason" : undefined}
            confirmLabel="Delete"
            onConfirm={async (reason) => {
              const result = await deleteResourceAction(resourceKey, id, reason || null);
              if (result.ok) {
                toast.success("Deleted");
                router.push(afterDelete);
                router.refresh();
              } else toast.error(result.error);
              return result;
            }}
          />
        )}
      </div>
    </form>
  );
}
