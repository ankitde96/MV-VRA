"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OffboardingChecklistItem {
  item_id: string;
  label: string;
  owner_id: string;
  owner_name: string;
  status: "pending" | "in_progress" | "done";
  completed_at: string | null;
}

export interface OffboardingView {
  id: string;
  engagement_id: string;
  status: "initiated" | "in_progress" | "verified" | "archived";
  checklist: OffboardingChecklistItem[];
  destruction_certificate: {
    uploaded_at: string;
    verified_at: string | null;
  } | null;
  asset_return_attestation: {
    uploaded_at: string;
    verified_at: string | null;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  initiated: "Checklist in progress",
  in_progress: "Checklist in progress",
  verified: "Ready to archive",
  archived: "Archived",
};

const CHECKLIST_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
};

/**
 * PLAN.md Phase 10 / FLOW.md F5. The internal-owner field for checklist items is a raw
 * `User._id` text input, same deliberate choice as Phase 9's CAP task dialog
 * (`components/risks/add-cap-task-dialog.tsx`, DECISIONS.md 013) — this MVP has exactly one
 * authenticatable internal user, so a real picker has nothing to populate yet.
 */
export function OffboardingPanel({
  vendorId,
  engagementId,
  engagementLabel,
  engagementEligible,
  offboarding,
}: {
  vendorId: string;
  engagementId: string;
  engagementLabel: string;
  engagementEligible: boolean;
  offboarding: OffboardingView | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [items, setItems] = useState([{ label: "", owner_id: "" }]);
  const destructionFileRef = useRef<HTMLInputElement>(null);
  const assetFileRef = useRef<HTMLInputElement>(null);

  async function call(key: string, url: string, opts: RequestInit) {
    setError(null);
    setLoading(key);
    try {
      const response = await fetch(url, opts);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Something went wrong.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setLoading(null);
    }
  }

  async function initiate() {
    const checklist_items = items
      .map((i) => ({ label: i.label.trim(), owner_id: i.owner_id.trim() }))
      .filter((i) => i.label && i.owner_id);
    if (checklist_items.length === 0) {
      setError("Add at least one checklist item with a label and owner.");
      return;
    }
    await call(
      "initiate",
      `/api/vendors/${vendorId}/engagements/${engagementId}/offboarding`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist_items }),
      },
    );
  }

  async function updateItem(itemId: string, status: string) {
    if (!offboarding) return;
    await call(
      `item-${itemId}`,
      `/api/offboarding/${offboarding.id}/checklist/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
  }

  async function uploadCertificate(
    kind: "destruction_certificate" | "asset_return_attestation",
  ) {
    if (!offboarding) return;
    const fileInput =
      kind === "destruction_certificate" ? destructionFileRef : assetFileRef;
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    const ok = await call(
      `upload-${kind}`,
      `/api/offboarding/${offboarding.id}/certificate/${kind}`,
      {
        method: "POST",
        body: formData,
      },
    );
    if (ok && fileInput.current) fileInput.current.value = "";
  }

  async function verifyCertificate(
    kind: "destruction_certificate" | "asset_return_attestation",
  ) {
    if (!offboarding) return;
    await call(
      `verify-${kind}`,
      `/api/offboarding/${offboarding.id}/certificate/${kind}/verify`,
      {
        method: "PATCH",
      },
    );
  }

  async function complete() {
    if (!offboarding) return;
    await call("complete", `/api/offboarding/${offboarding.id}/complete`, {
      method: "POST",
    });
  }

  if (!offboarding) {
    if (!engagementEligible) {
      return (
        <p className="text-muted-foreground text-sm">
          {engagementLabel} — already offboarding or closed.
        </p>
      );
    }
    return (
      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{engagementLabel}</span>
          <Badge variant="outline">Not started</Badge>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Checklist item (e.g. Revoke system access)"
                value={item.label}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) =>
                      i === idx ? { ...it, label: e.target.value } : it,
                    ),
                  )
                }
              />
              <Input
                placeholder="Owner User ID"
                className="w-48"
                value={item.owner_id}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) =>
                      i === idx ? { ...it, owner_id: e.target.value } : it,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((prev) => [...prev, { label: "", owner_id: "" }])
            }
          >
            + Add item
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading === "initiate"}
            onClick={initiate}
          >
            {loading === "initiate" ? "Starting…" : "Initiate Offboarding"}
          </Button>
        </div>
      </div>
    );
  }

  const isArchived = offboarding.status === "archived";
  const readyToComplete = offboarding.status === "verified";

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{engagementLabel}</span>
        <Badge variant={isArchived ? "default" : "outline"}>
          {STATUS_LABEL[offboarding.status]}
        </Badge>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold uppercase">
          Checklist
        </p>
        <ul className="divide-border divide-y rounded-md border">
          {offboarding.checklist.map((item) => (
            <li
              key={item.item_id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">{item.label}</p>
                <p className="text-muted-foreground text-xs">
                  Owner: {item.owner_name}
                </p>
              </div>
              {isArchived ? (
                <Badge variant="outline">
                  {CHECKLIST_STATUS_LABEL[item.status]}
                </Badge>
              ) : (
                <Select
                  value={item.status}
                  onValueChange={(value) =>
                    value && updateItem(item.item_id, value)
                  }
                >
                  <SelectTrigger className="w-36 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            [
              "destruction_certificate",
              "Certificate of Data Destruction",
              destructionFileRef,
            ],
            [
              "asset_return_attestation",
              "Asset Return Attestation",
              assetFileRef,
            ],
          ] as const
        ).map(([kind, title, ref]) => {
          const cert = offboarding[kind];
          return (
            <div key={kind} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">{title}</Label>
                {cert ? (
                  <Badge variant={cert.verified_at ? "default" : "outline"}>
                    {cert.verified_at ? "Verified" : "Uploaded"}
                  </Badge>
                ) : (
                  <Badge variant="outline">Not uploaded</Badge>
                )}
              </div>
              {isArchived ? null : !cert ? (
                <div className="flex items-center gap-2">
                  <input ref={ref} type="file" className="text-xs" />
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading === `upload-${kind}`}
                    onClick={() => uploadCertificate(kind)}
                  >
                    Upload
                  </Button>
                </div>
              ) : !cert.verified_at ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading === `verify-${kind}`}
                  onClick={() => verifyCertificate(kind)}
                >
                  {loading === `verify-${kind}`
                    ? "Verifying…"
                    : "Mark Verified"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {isArchived ? (
        <p className="text-muted-foreground text-xs">
          Offboarding archived — this record and its assessments are now
          immutable.
        </p>
      ) : (
        <Button
          type="button"
          disabled={!readyToComplete || loading === "complete"}
          onClick={complete}
        >
          {loading === "complete" ? "Archiving…" : "Complete & Archive"}
        </Button>
      )}
    </div>
  );
}
