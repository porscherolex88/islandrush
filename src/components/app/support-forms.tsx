"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { createTicketAction, replyTicketAction } from "@/server/actions/account";

const CATEGORIES = [
  { value: "GENERAL", label: "General question" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "GAMES", label: "Games and rewards" },
  { value: "ACCOUNT", label: "Account and security" },
  { value: "REFERRALS", label: "Referrals" },
];

export function NewTicketForm() {
  const router = useRouter();
  const [v, setV] = useState({ subject: "", category: "GENERAL", body: "" });
  const { run, pending } = useAction(createTicketAction, {
    success: "Ticket created. We'll reply soon.",
    refresh: false,
    onSuccess: (d) => router.push(`/app/account/support/${d.id}`),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(v);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="cat">Topic</Label>
        <select id="cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} className="h-11 rounded-lg border bg-background px-3 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} maxLength={120} required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="body">How can we help?</Label>
        <Textarea id="body" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={5} maxLength={4000} required />
        <p className="text-xs text-muted-foreground">Include references like deposit or withdrawal amounts and dates. Never share your password.</p>
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Send
      </Button>
    </form>
  );
}

export function TicketReplyForm({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const [body, setBody] = useState("");
  const { run, pending } = useAction(replyTicketAction, { success: "Reply sent", onSuccess: () => setBody("") });
  if (closed) return <p className="rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">This ticket is closed. Open a new ticket if you need more help.</p>;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(ticketId, body);
      }}
    >
      <Label htmlFor="reply" className="sr-only">
        Reply
      </Label>
      <Textarea id="reply" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write a reply..." maxLength={4000} required />
      <Button type="submit" className="w-full" size="xl" disabled={pending || !body.trim()}>
        {pending && <Loader2 className="animate-spin" />}
        Send reply
      </Button>
    </form>
  );
}
