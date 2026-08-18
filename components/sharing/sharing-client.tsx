"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Share2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/layout/empty-state";
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

interface GrantedRow {
  key: string;
  share_id: string;
  vendor_domain: string;
  workspace_id: string;
  workspace_name: string;
  granted_at: string;
}

/**
 * UI Revamp Round 2 Phase F (`docs/UI-REVAMP-2-PLAN.md`) — closes two Round 1 debts
 * (`docs/features/ui-revamp.md` §11): last hand-rolled list not on `DataTable`, and last
 * form still surfacing errors via inline `Alert` instead of `toast()`. A granted share's
 * `shared_with[]` is flattened to one `DataTable` row per (share, target workspace) pair —
 * revoke acts on that one pairing, matching what `handleRevoke()` already took as args.
 */
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
      toast.error(
        "Pick a vendor, a document, and at least one target workspace.",
      );
      return;
    }
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
        toast.error(body?.message ?? "Failed to grant share.");
        return;
      }
      toast.success("Share granted.");
      setTargetIds(new Set());
      const listRes = await fetch("/api/sharing/granted");
      if (listRes.ok) setGranted((await listRes.json()).shares);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(shareId: string, targetWorkspaceId: string) {
    const res = await fetch(`/api/sharing/${shareId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_workspace_id: targetWorkspaceId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? "Failed to revoke share.");
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
    toast.success("Share revoked.");
  }

  const grantedRows: GrantedRow[] = granted.flatMap((s) =>
    s.shared_with.map((w) => ({
      key: `${s.id}:${w.workspace_id}`,
      share_id: s.id,
      vendor_domain: s.vendor_domain,
      workspace_id: w.workspace_id,
      workspace_name: w.workspace_name,
      granted_at: s.granted_at,
    })),
  );

  const grantedColumns: ColumnDef<GrantedRow>[] = [
    {
      accessorKey: "vendor_domain",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.vendor_domain}</span>
      ),
    },
    {
      accessorKey: "workspace_name",
      header: "Shared with",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.workspace_name}</Badge>
      ),
    },
    {
      accessorKey: "granted_at",
      header: "Granted",
      cell: ({ row }) => row.original.granted_at.slice(0, 10),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handleRevoke(row.original.share_id, row.original.workspace_id)
          }
        >
          Revoke
        </Button>
      ),
    },
  ];

  const availableColumns: ColumnDef<AvailableShare>[] = [
    {
      accessorKey: "vendor_domain",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.vendor_domain}</span>
      ),
    },
    { accessorKey: "owner_workspace_name", header: "From" },
    {
      accessorKey: "granted_at",
      header: "Granted",
      cell: ({ row }) => row.original.granted_at.slice(0, 10),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          render={<a href={`/api/sharing/${row.original.id}/download`} />}
        >
          Download
        </Button>
      ),
    },
  ];

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
          {grantedRows.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="Nothing shared out yet"
              description="Grant a share above to see it here."
            />
          ) : (
            <DataTable columns={grantedColumns} data={grantedRows} />
          )}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-medium">Shared with this workspace</h2>
        {available.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing shared with you yet"
            description="Documents another workspace shares with you appear here."
          />
        ) : (
          <DataTable columns={availableColumns} data={available} />
        )}
      </div>
    </div>
  );
}
