"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { setConfigAction } from "@/server/actions/admin/ops";

type Option = { value: string; label: string };
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function label(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Renders a form from the shape of a config value. Pool id fields become pool pickers. */
export function ConfigForm({ configKey, value, defaults, pools = [], help = {} }: { configKey: string; value: Json; defaults: Json; pools?: Option[]; help?: Record<string, string> }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Json>(value);
  const isObject = draft !== null && typeof draft === "object" && !Array.isArray(draft);

  function setField(k: string, v: Json) {
    if (!isObject) setDraft(v);
    else setDraft((d) => ({ ...(d as Record<string, Json>), [k]: v }));
  }

  function renderField(k: string, v: Json, def: Json) {
    const id = `cfg-${configKey}-${k}`;
    if (typeof def === "boolean" || typeof v === "boolean") {
      return (
        <div key={k} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <Label htmlFor={id}>{label(k)}</Label>
          <Switch id={id} checked={Boolean(v)} onCheckedChange={(c) => setField(k, c)} />
        </div>
      );
    }
    let control;
    if (/PoolId$/.test(k)) {
      control = (
        <select id={id} value={(v as string) ?? ""} onChange={(e) => setField(k, e.target.value || null)} className="h-9 rounded-md border bg-background px-2.5 text-sm">
          <option value="">None</option>
          {pools.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      );
    } else if (Array.isArray(def) || Array.isArray(v)) {
      control = <Textarea id={id} rows={3} value={((v as Json[]) ?? []).join("\n")} onChange={(e) => setField(k, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />;
    } else if (typeof def === "number" || (def === null && typeof v === "number")) {
      control = <Input id={id} type="number" value={v === null ? "" : String(v)} onChange={(e) => setField(k, e.target.value === "" ? null : Number(e.target.value))} />;
    } else {
      control = <Input id={id} value={v === null ? "" : String(v)} onChange={(e) => setField(k, e.target.value === "" && def === null ? null : e.target.value)} />;
    }
    return (
      <div key={k} className="grid content-start gap-1.5">
        <Label htmlFor={id}>{label(k)}</Label>
        {control}
        {help[k] && <p className="text-xs text-muted-foreground">{help[k]}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isObject ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(draft as Record<string, Json>).map(([k, v]) => renderField(k, v, (defaults as Record<string, Json>)?.[k] ?? null))}
        </div>
      ) : (
        <div className="grid max-w-sm gap-1.5">{renderField("value", draft, defaults)}</div>
      )}
      <ConfirmDialog
        trigger={<Button>Save settings</Button>}
        title="Save settings?"
        description="The change applies immediately. Old and new values are recorded in the audit log."
        reasonLabel="Reason for change"
        confirmLabel="Save"
        onConfirm={async (reason) => {
          const result = await setConfigAction(configKey, draft, reason);
          if (result.ok) {
            toast.success("Settings saved");
            router.refresh();
          } else toast.error(result.error);
          return result;
        }}
      />
    </div>
  );
}
