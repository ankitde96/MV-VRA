"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Role = "admin" | "risk_analyst" | "business_owner" | "viewer";

interface WorkspaceUser {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled";
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "risk_analyst", label: "Risk Analyst" },
  { value: "business_owner", label: "Business Owner" },
  { value: "viewer", label: "Viewer" },
];

/**
 * UI Revamp Round 2 Phase F (`docs/UI-REVAMP-2-PLAN.md`) — closes a Round 1 debt
 * (`docs/features/ui-revamp.md` §11): this was the last hand-rolled `<table>` still not on
 * the shared `DataTable` (vendors/risk-register/templates already migrated). Role/remove
 * controls stay as interactive cell renderers — no `onRowClick`, since there's no per-user
 * detail page to navigate to and these cells need their own click targets.
 */
export function AdminUsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: WorkspaceUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message ?? "Failed to add user.");
        return;
      }
      toast.success(`${email} added to the workspace.`);
      setEmail("");
      setName("");
      setPassword("");
      setRole("viewer");
      router.refresh();
      const listRes = await fetch("/api/admin/users");
      if (listRes.ok) setUsers((await listRes.json()).users);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? "Failed to update role.");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u)),
    );
    toast.success("Role updated.");
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.message ?? "Failed to remove user from workspace.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    toast.success("User removed from workspace.");
  }

  const columns: ColumnDef<WorkspaceUser>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Select
          value={row.original.role}
          onValueChange={(v) =>
            v && handleRoleChange(row.original.user_id, v as Role)
          }
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "secondary" : "outline"}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.user_id !== currentUserId ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRemove(row.original.user_id)}
          >
            Remove
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">You</span>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Workspace Users</h1>
        <p className="text-muted-foreground text-sm">
          Manage who has access to this workspace and what role they hold.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-5 items-end gap-3 rounded-lg border p-4"
      >
        <div className="space-y-1">
          <Label htmlFor="new-user-email">Email *</Label>
          <Input
            id="new-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-user-name">Name *</Label>
          <Input
            id="new-user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-user-role">Role *</Label>
          <Select value={role} onValueChange={(v) => v && setRole(v as Role)}>
            <SelectTrigger id="new-user-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-user-password">Initial password *</Label>
          <Input
            id="new-user-password"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Adding…" : "Add user"}
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Add the first user above."
        />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchKey="name"
          searchPlaceholder="Search users..."
        />
      )}
    </div>
  );
}
