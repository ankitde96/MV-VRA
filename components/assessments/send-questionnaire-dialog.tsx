"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface QuestionnaireRecipient {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export function SendQuestionnaireDialog({
  assessmentId,
  recipients,
}: {
  assessmentId: string;
  recipients: QuestionnaireRecipient[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(
    () => new Set(recipients.map((r) => r.id)),
  );
  const [sending, setSending] = useState(false);

  async function send() {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoc_ids: [...selected] }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Could not send the questionnaire.");
        return;
      }
      toast.success("Questionnaire sent.");
      setOpen(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" disabled={recipients.length === 0} />}
      >
        Send questionnaire
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose questionnaire recipients</DialogTitle>
          <DialogDescription>
            Only selected SPOCs will be able to find or open this assessment.
            All active SPOCs are selected by default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {recipients.map((recipient) => (
            <label
              key={recipient.id}
              className="flex cursor-pointer gap-3 rounded-md border p-3"
            >
              <Checkbox
                checked={selected.has(recipient.id)}
                onCheckedChange={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(recipient.id);
                    else next.delete(recipient.id);
                    return next;
                  })
                }
              />
              <span className="min-w-0 text-sm">
                <span className="block font-medium">{recipient.name}</span>
                <span className="text-muted-foreground block break-all">
                  {recipient.email} · {recipient.phone}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={selected.size === 0 || sending}>
            {sending ? "Sending…" : "Send questionnaire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
