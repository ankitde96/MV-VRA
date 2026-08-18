"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Membership {
  workspace_id: string;
  workspace_name: string;
  role: string;
}

/**
 * Phase 11 — only ever renders a dropdown of workspaces the logged-in user actually has a
 * membership in (`GET /api/auth/memberships`, backed by `listMembershipsForUser()`), never a
 * list of every workspace that exists. Switching re-signs the session cookie server-side
 * (`POST /api/auth/switch-workspace`) rather than storing the choice client-side — every
 * subsequent request, including the very next one this triggers via `router.refresh()`,
 * re-derives its scope from that cookie, the same discipline every other tenant-scoped read
 * in this codebase already follows.
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    null,
  );
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/auth/memberships")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setMemberships(data.memberships);
        setCurrentWorkspaceId(data.current_workspace_id);
      })
      .catch(() => {});
  }, []);

  async function handleSwitch(workspaceId: string | null) {
    if (!workspaceId || workspaceId === currentWorkspaceId) return;
    setSwitching(true);
    const res = await fetch("/api/auth/switch-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    setSwitching(false);
    if (res.ok) {
      setCurrentWorkspaceId(workspaceId);
      router.refresh();
    }
  }

  const currentMembership = memberships.find(
    (membership) => membership.workspace_id === currentWorkspaceId,
  );

  // DESIGN-SYSTEM.md §4 (WorkspaceSwitcher): "current workspace always visible — acting in
  // the wrong tenant is a real error." A single-membership user still sees which workspace
  // they're in, just without a dropdown to switch out of (nothing to switch to).
  if (memberships.length === 0) return null;
  if (memberships.length === 1) {
    const only = memberships[0];
    return (
      <div className="flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
        <span className="truncate font-medium">{only.workspace_name}</span>
        <span className="text-muted-foreground shrink-0">({only.role})</span>
      </div>
    );
  }

  return (
    <Select
      value={currentWorkspaceId ?? undefined}
      onValueChange={handleSwitch}
    >
      <SelectTrigger
        size="sm"
        className="w-full min-w-0 max-w-full overflow-hidden"
        disabled={switching}
        title={currentMembership?.workspace_name}
      >
        <SelectValue
          placeholder="Select workspace"
          className="min-w-0 overflow-hidden"
        >
          {currentMembership?.workspace_name}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {memberships.map((m) => (
          <SelectItem key={m.workspace_id} value={m.workspace_id}>
            {m.workspace_name} ({m.role})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
