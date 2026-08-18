"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddCapTaskDialogProps {
  riskId: string;
  riskTitle: string;
  vendorName: string;
  defaultDescription?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * PLAN.md Phase 9 item 1 — CAP tasks with an owner (internal or vendor SPOC) and a due
 * date. Owner assignment intentionally has no free-text internal-user picker: this MVP has
 * exactly one authenticated internal principal (DECISIONS.md 013's SUPER_ADMIN_EMAIL gate),
 * so "internal" defaults to the current session's own user id server-side would be the only
 * sane default — instead this form asks for a User id directly, since a real multi-user
 * owner picker is out of scope until that gate is lifted.
 */
export function AddCapTaskDialog({
  riskId,
  riskTitle,
  vendorName,
  defaultDescription = "",
  open,
  onOpenChange,
}: AddCapTaskDialogProps) {
  const router = useRouter();
  const [description, setDescription] = useState(defaultDescription);
  const [ownerType, setOwnerType] = useState<"vendor" | "internal">("vendor");
  const [ownerRef, setOwnerRef] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !dueDate) {
      setError("Please provide a description and due date.");
      return;
    }
    if (ownerType === "internal" && !ownerRef.trim()) {
      setError("An internal owner requires a User id.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/risks/${riskId}/cap-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          owner_type: ownerType,
          owner_ref: ownerType === "internal" ? ownerRef.trim() : undefined,
          due_date: dueDate,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Failed to create CAP task.");
        return;
      }

      toast.success("Corrective action task created.");
      onOpenChange(false);
      setDescription("");
      setOwnerRef("");
      setDueDate("");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Corrective Action — {riskTitle}</DialogTitle>
          <DialogDescription>
            Track a remediation task against this risk, owned internally or by
            the vendor SPOC.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="cap-description">Description *</Label>
            <Textarea
              id="cap-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Provide updated encryption-at-rest evidence"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="owner-type">Owner *</Label>
              <Select
                value={ownerType}
                onValueChange={(v) => setOwnerType(v as "vendor" | "internal")}
              >
                <SelectTrigger id="owner-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">
                    Vendor SPOC ({vendorName})
                  </SelectItem>
                  <SelectItem value="internal">Internal user</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="due-date">Due Date *</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {ownerType === "internal" ? (
            <div className="space-y-1">
              <Label htmlFor="owner-ref">Internal Owner User ID *</Label>
              <Input
                id="owner-ref"
                value={ownerRef}
                onChange={(e) => setOwnerRef(e.target.value)}
                placeholder="Mongo User _id"
                required
              />
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add Corrective Action"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
