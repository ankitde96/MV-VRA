"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SpocRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_primary: boolean;
  status: "active" | "inactive";
}

interface SpocEditFormProps {
  vendorId: string;
  initialSpocs: SpocRow[];
}

const emptyFields = { name: "", email: "", phone: "" };

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2, requirement #4 — a vendor may now have more than
 * one SPOC. Add / edit / deactivate-reactivate / set-primary, each a small `PATCH` (or one
 * `POST` for add) against `/api/vendors/[id]/spocs[/spocId]`, followed by `router.refresh()`
 * to re-read the authoritative list from the server rather than reconciling optimistic
 * local state — this list changes rarely enough that the extra round trip is not felt.
 */
export function SpocEditForm({ vendorId, initialSpocs }: SpocEditFormProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addFields, setAddFields] = useState(emptyFields);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState(emptyFields);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function patchSpoc(spocId: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/vendors/${vendorId}/spocs/${spocId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      toast.error(
        responseBody?.message ?? "Could not update the SPOC. Please try again.",
      );
      return false;
    }
    return true;
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingId("new");
    try {
      const response = await fetch(`/api/vendors/${vendorId}/spocs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addFields),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Could not add the SPOC.");
        return;
      }
      toast.success("SPOC added.");
      setAdding(false);
      setAddFields(emptyFields);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleSaveEdit(spocId: string) {
    setPendingId(spocId);
    try {
      const ok = await patchSpoc(spocId, editFields);
      if (ok) {
        toast.success("SPOC saved.");
        setEditingId(null);
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleStatusToggle(
    spocId: string,
    nextStatus: "active" | "inactive",
  ) {
    setPendingId(spocId);
    try {
      const ok = await patchSpoc(spocId, { status: nextStatus });
      if (ok) {
        toast.success(
          nextStatus === "inactive" ? "SPOC deactivated." : "SPOC reactivated.",
        );
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleMakePrimary(spocId: string) {
    setPendingId(spocId);
    try {
      const ok = await patchSpoc(spocId, { make_primary: true });
      if (ok) {
        toast.success("Primary SPOC updated.");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <ul className="divide-y rounded-lg border bg-card">
        {initialSpocs.map((spoc) => (
          <li key={spoc.id} className="space-y-3 p-4">
            {editingId === spoc.id ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${spoc.id}`}>Name</Label>
                  <Input
                    id={`name-${spoc.id}`}
                    value={editFields.name}
                    onChange={(e) =>
                      setEditFields({ ...editFields, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`email-${spoc.id}`}>Email</Label>
                  <Input
                    id={`email-${spoc.id}`}
                    type="email"
                    value={editFields.email}
                    onChange={(e) =>
                      setEditFields({ ...editFields, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`phone-${spoc.id}`}>Phone</Label>
                  <Input
                    id={`phone-${spoc.id}`}
                    value={editFields.phone}
                    onChange={(e) =>
                      setEditFields({ ...editFields, phone: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pendingId === spoc.id}
                    onClick={() => void handleSaveEdit(spoc.id)}
                  >
                    {pendingId === spoc.id ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {spoc.name}
                    {spoc.is_primary ? (
                      <span className="text-primary ml-2 text-xs font-semibold uppercase">
                        Primary
                      </span>
                    ) : null}
                    {spoc.status === "inactive" ? (
                      <span className="text-muted-foreground ml-2 text-xs font-semibold uppercase">
                        Inactive
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {spoc.email} · {spoc.phone}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(spoc.id);
                      setEditFields({
                        name: spoc.name,
                        email: spoc.email,
                        phone: spoc.phone,
                      });
                    }}
                  >
                    Edit
                  </Button>
                  {!spoc.is_primary && spoc.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingId === spoc.id}
                      onClick={() => void handleMakePrimary(spoc.id)}
                    >
                      Make primary
                    </Button>
                  ) : null}
                  {spoc.status === "active" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={spoc.is_primary || pendingId === spoc.id}
                      title={
                        spoc.is_primary
                          ? "Set a different SPOC as primary first"
                          : undefined
                      }
                      onClick={() =>
                        void handleStatusToggle(spoc.id, "inactive")
                      }
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === spoc.id}
                      onClick={() => void handleStatusToggle(spoc.id, "active")}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {initialSpocs.length === 0 ? (
          <li className="text-muted-foreground p-4 text-sm">
            No SPOCs yet — add one below.
          </li>
        ) : null}
      </ul>

      {adding ? (
        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-lg border bg-card p-4"
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_spoc_name">Name</Label>
              <Input
                id="new_spoc_name"
                required
                value={addFields.name}
                onChange={(e) =>
                  setAddFields({ ...addFields, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_spoc_email">Email</Label>
              <Input
                id="new_spoc_email"
                type="email"
                required
                value={addFields.email}
                onChange={(e) =>
                  setAddFields({ ...addFields, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_spoc_phone">Phone</Label>
              <Input
                id="new_spoc_phone"
                required
                value={addFields.phone}
                onChange={(e) =>
                  setAddFields({ ...addFields, phone: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pendingId === "new"}>
              {pendingId === "new" ? "Adding…" : "Add SPOC"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setAddFields(emptyFields);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>
          Add SPOC
        </Button>
      )}
    </div>
  );
}
