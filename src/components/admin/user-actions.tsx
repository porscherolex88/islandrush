"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createManualFlagAction, sendUserNotificationAction, setVerificationAction } from "@/server/actions/admin/ops";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(success);
        after?.();
        router.refresh();
      } else toast.error((r as { error: string }).error);
    });
  return { pending, run };
}

export function VerificationControls({ userId, status, required }: { userId: string; status: string; required: boolean }) {
  const { pending, run } = useRun();
  const [next, setNext] = useState(status);
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Verification status</Label>
      <div className="flex gap-2">
        <select value={next} onChange={(e) => setNext(e.target.value)} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm">
          {["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button size="sm" className="h-9" disabled={pending || next === status} onClick={() => run(() => setVerificationAction(userId, { status: next as "VERIFIED" }, note || null), "Verification updated", () => setNote(""))}>
          Update
        </Button>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note shown to the user (optional)" />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => setVerificationAction(userId, { required: !required }, required ? "Verification requirement removed" : "Verification required before withdrawal"), required ? "Requirement removed" : "Verification now required")}
      >
        {required ? "Remove verification requirement" : "Require verification"}
      </Button>
    </div>
  );
}

export function ManualFlagForm({ userId }: { userId: string }) {
  const { pending, run } = useRun();
  const [severity, setSeverity] = useState("MEDIUM");
  const [summary, setSummary] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createManualFlagAction(userId, { severity: severity as "MEDIUM", summary }), "Flag created", () => setSummary(""));
      }}
    >
      <Label className="text-xs text-muted-foreground">Open a manual review</Label>
      <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
      </select>
      <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="What should reviewers look at?" />
      <div>
        <Button size="sm" type="submit" disabled={pending || summary.trim().length < 5}>
          {pending && <Loader2 className="animate-spin" />}
          Create flag
        </Button>
      </div>
    </form>
  );
}

export function SendNotificationForm({ userId }: { userId: string }) {
  const { pending, run } = useRun();
  const [v, setV] = useState({ title: "", body: "", link: "" });
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => sendUserNotificationAction(userId, { title: v.title, body: v.body, link: v.link || undefined }), "Notification sent", () => setV({ title: "", body: "", link: "" }));
      }}
    >
      <Label className="text-xs text-muted-foreground">Send in-app notification</Label>
      <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Title" required />
      <Textarea value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={2} placeholder="Message" required />
      <Input value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} placeholder="Link (optional), e.g. /wallet" />
      <div>
        <Button size="sm" type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Send
        </Button>
      </div>
    </form>
  );
}
