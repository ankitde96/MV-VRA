"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VendorOption {
  id: string;
  legal_name: string;
  domain: string;
  documents: { id: string; filename: string }[];
}

interface WorkspaceOption {
  id: string;
  entity_name: string;
}

interface GrantedShare {
  id: string;
  vendor_domain: string;
  document_ref: { vendor_id: string; document_id: string };
  shared_with: { workspace_id: string; workspace_name: string }[];
  granted_at: string;
  expires_at: string | null;
}

interface AvailableShare {
  id: string;
  owner_workspace_id: string;
  owner_workspace_name: string;
  vendor_domain: string;
  document_ref: { vendor_id: string; document_id: string };
  granted_at: string;
  expires_at: string | null;
}

export function SharingClient({
  canManage,
  vendors,
  otherWorkspaces,
  initialGranted,
  initialAvailable,
}: {
  canManage: boolean;
  vendors: VendorOption[];
  otherWorkspaces: WorkspaceOption[];
  initialGranted: GrantedShare[];
  initialAvailable: AvailableShare[];
}) {
  const [vendorId, setVendorId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [granted, setGranted] = useState(initialGranted);
  const [available] = useState(initialAvailable);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  function toggleTarget(id: string) {
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !documentId || targetIds.size === 0) {
      setError("Pick a vendor, a document, and at least one target workspace.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendorId,
          document_id: documentId,
          target_workspace_ids: [...targetIds],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Failed to grant share.");
        return;
      }
      setTargetIds(new Set());
      const listRes = await fetch("/api/sharing/granted");
      if (listRes.ok) setGranted((await listRes.json()).shares);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(shareId: string, targetWorkspaceId: string) {
    setError(null);
    const res = await fetch(`/api/sharing/${shareId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_workspace_id: targetWorkspaceId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? "Failed to revoke share.");
      return;
    }
    setGranted((prev) =>
      prev.map((s) =>
        s.id === shareId
          ? {
              ...s,
              shared_with: s.shared_with.filter(
                (w) => w.workspace_id !== targetWorkspaceId,
              ),
            }
          : s,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-foreground text-lg font-semibold">
          Cross-Workspace Document Sharing
        </h1>
        <p className="text-muted-foreground text-sm">
          Share a verified vendor document with a sibling workspace so it
          doesn&apos;t need to be re-collected. Every read of a shared document
          is recorded as an audit event.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canManage ? (
        <form
          onSubmit={handleGrant}
          className="space-y-4 rounded-lg border p-4"
        >
          <h2 className="text-sm font-medium">Grant a new share</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Select
                value={vendorId}
                onValueChange={(v) => {
                  setVendorId(v ?? "");
                  setDocumentId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.legal_name} ({v.domain})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Document</Label>
              <Select
                value={documentId}
                onValueChange={(v) => setDocumentId(v ?? "")}
              >
                <SelectTrigger className="w-full" disabled={!selectedVendor}>
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent>
                  {selectedVendor?.documents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Share with</Label>
            <div className="flex flex-wrap gap-4">
              {otherWorkspaces.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No other workspaces exist yet.
                </p>
              ) : (
                otherWorkspaces.map((w) => (
                  <label key={w.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={targetIds.has(w.id)}
                      onCheckedChange={() => toggleTarget(w.id)}
                    />
                    {w.entity_name}
                  </label>
                ))
              )}
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Granting…" : "Grant share"}
          </Button>
        </form>
      ) : null}

      {canManage ? (
        <div>
          <h2 className="mb-3 text-sm font-medium">Shared by this workspace</h2>
          {granted.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing shared out yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {granted.map((s) => (
                <li key={s.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{s.vendor_domain}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {s.shared_with.map((w) => (
                      <span
                        key={w.workspace_id}
                        className="bg-secondary inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-xs"
                      >
                        {w.workspace_name}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleRevoke(s.id, w.workspace_id)}
                        >
                          revoke
                        </button>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-medium">Shared with this workspace</h2>
        {available.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing has been shared with you yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {available.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{s.vendor_domain}</div>
                  <div className="text-muted-foreground text-xs">
                    from {s.owner_workspace_name}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={`/api/sharing/${s.id}/download`} />}
                >
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
