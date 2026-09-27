"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { staffReplyAction, updateTicketsAction } from "@/server/actions/admin/ops";

const STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
type Patch = Parameters<typeof updateTicketsAction>[1];

const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => ReturnType<typeof updateTicketsAction>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(success);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return { pending, run };
}

export function BulkTicketBar() {
  const { pending, run } = useRun();
  const [op, setOp] = useState("assignToMe");
  function patchFor(value: string): Patch {
    if (value === "assignToMe") return { assignToMe: true };
    if (value === "unassign") return { unassign: true };
    const [kind, v] = value.split(":");
    return kind === "status" ? { status: v as Patch["status"] } : { priority: v as Patch["priority"] };
  }
  return (
    <form
      id="tickets-form"
      className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const ids = new FormData(e.currentTarget).getAll("tickets").map(String);
        if (!ids.length) return void toast.error("Select tickets first");
        run(() => updateTicketsAction(ids, patchFor(op)), `Updated ${ids.length} ticket${ids.length === 1 ? "" : "s"}`, () => {
          document.querySelectorAll<HTMLInputElement>('input[name="tickets"]').forEach((c) => (c.checked = false));
        });
      }}
    >
      <span className="text-sm text-muted-foreground">With selected:</span>
      <select value={op} onChange={(e) => setOp(e.target.value)} className={selectCls} aria-label="Bulk action">
        <option value="assignToMe">Assign to me</option>
        <option value="unassign">Unassign</option>
        {STATUSES.map((s) => (
          <option key={s} value={`status:${s}`}>
            Set status: {s.toLowerCase()}
          </option>
        ))}
        {PRIORITIES.map((p) => (
          <option key={p} value={`priority:${p}`}>
            Set priority: {p.toLowerCase()}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Apply
      </Button>
    </form>
  );
}

export function StaffReplyBox({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await staffReplyAction(ticketId, body, internal);
          if (r.ok) {
            toast.success(internal ? "Internal note added" : "Reply sent");
            setBody("");
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder={internal ? "Internal note, only visible to staff" : closed ? "Replying reopens this ticket" : "Write a reply to the player"}
        className={internal ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : undefined}
        required
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={internal} onCheckedChange={setInternal} />
          Internal note
        </label>
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending && <Loader2 className="animate-spin" />}
          {internal ? "Add note" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

export function TicketSettings({ ticketId, status, priority, tags, resolution, assignedToMe, assigned }: { ticketId: string; status: string; priority: string; tags: string[]; resolution: string | null; assignedToMe: boolean; assigned: boolean }) {
  const { pending, run } = useRun();
  const [s, setS] = useState(status);
  const [p, setP] = useState(priority);
  const [t, setT] = useState(tags.join(", "));
  const [res, setRes] = useState(resolution ?? "");
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <select value={s} onChange={(e) => setS(e.target.value)} className={selectCls}>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground">Priority</Label>
          <select value={p} onChange={(e) => setP(e.target.value)} className={selectCls}>
            {PRIORITIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Tags (comma separated)</Label>
        <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="withdrawal, verification" />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Resolution</Label>
        <Textarea value={res} onChange={(e) => setRes(e.target.value)} rows={2} maxLength={2000} placeholder="How was this resolved?" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                updateTicketsAction([ticketId], {
                  status: s as Patch["status"],
                  priority: p as Patch["priority"],
                  tags: t.split(",").map((x) => x.trim()).filter(Boolean),
                  resolution: res,
                }),
              "Ticket updated",
            )
          }
        >
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
        {!assignedToMe && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateTicketsAction([ticketId], { assignToMe: true }), "Assigned to you")}>
            Assign to me
          </Button>
        )}
        {assigned && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateTicketsAction([ticketId], { unassign: true }), "Unassigned")}>
            Unassign
          </Button>
        )}
      </div>
    </div>
  );
}
