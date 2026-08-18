"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkspaceItem {
  workspace_id: string;
  entity_name: string;
  slug: string;
  status: "active" | "suspended";
}

export function AdminWorkspacesClient({
  initialWorkspaces,
  currentWorkspaceId,
}: {
  initialWorkspaces: WorkspaceItem[];
  currentWorkspaceId: string;
}) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);

  async function addWorkspace(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_name: name, slug }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        return toast.error(body?.message ?? "Failed to add workspace.");
      setWorkspaces((items) => [...items, body]);
      setName("");
      setSlug("");
      toast.success("Workspace added.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function saveWorkspace(workspace: WorkspaceItem) {
    const response = await fetch(
      `/api/admin/workspaces/${workspace.workspace_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspace),
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok)
      return toast.error(body?.message ?? "Failed to update workspace.");
    setWorkspaces((items) =>
      items.map((item) =>
        item.workspace_id === body.workspace_id ? body : item,
      ),
    );
    toast.success("Workspace updated.");
  }

  async function removeWorkspace(workspace: WorkspaceItem) {
    if (
      !window.confirm(
        `Delete “${workspace.entity_name}”? This cannot be undone.`,
      )
    )
      return;
    const response = await fetch(
      `/api/admin/workspaces/${workspace.workspace_id}`,
      {
        method: "DELETE",
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok)
      return toast.error(body?.message ?? "Failed to delete workspace.");
    setWorkspaces((items) =>
      items.filter((item) => item.workspace_id !== workspace.workspace_id),
    );
    toast.success("Workspace deleted.");
  }

  function change(id: string, updates: Partial<WorkspaceItem>) {
    setWorkspaces((items) =>
      items.map((item) =>
        item.workspace_id === id ? { ...item, ...updates } : item,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Workspaces</h1>
        <p className="text-muted-foreground text-sm">
          Add, edit, suspend, or delete tenant workspaces.
        </p>
      </div>

      <form
        onSubmit={addWorkspace}
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="space-y-1">
          <Label htmlFor="workspace-name">Workspace name *</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="workspace-slug">Slug *</Label>
          <Input
            id="workspace-slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="example-workspace"
            required
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Adding…" : "Add workspace"}
        </Button>
      </form>

      <div className="space-y-3">
        {workspaces.map((workspace) => (
          <Card key={workspace.workspace_id}>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-[1.5fr_1fr_10rem_auto_auto] sm:items-end">
              <div className="space-y-1">
                <Label htmlFor={`name-${workspace.workspace_id}`}>Name</Label>
                <Input
                  id={`name-${workspace.workspace_id}`}
                  value={workspace.entity_name}
                  onChange={(event) =>
                    change(workspace.workspace_id, {
                      entity_name: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`slug-${workspace.workspace_id}`}>Slug</Label>
                <Input
                  id={`slug-${workspace.workspace_id}`}
                  value={workspace.slug}
                  onChange={(event) =>
                    change(workspace.workspace_id, { slug: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={workspace.status}
                  onValueChange={(value) =>
                    value &&
                    change(workspace.workspace_id, {
                      status: value as WorkspaceItem["status"],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => saveWorkspace(workspace)}
              >
                Save
              </Button>
              {workspace.workspace_id === currentWorkspaceId ? (
                <Badge variant="secondary" className="justify-center">
                  Current
                </Badge>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => removeWorkspace(workspace)}
                >
                  Delete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
