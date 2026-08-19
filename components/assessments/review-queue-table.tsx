"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/domain/status-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { assessmentStatusLabel } from "@/lib/assessments/status-label";

export interface ReviewQueueRow {
  id: string;
  vendor: string;
  template_version: number;
  status: string;
  submitted_at: string | null;
}

const columns: ColumnDef<ReviewQueueRow>[] = [
  {
    accessorKey: "vendor",
    header: "Vendor",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.vendor}</span>
    ),
  },
  {
    accessorKey: "template_version",
    header: "Template version",
    cell: ({ row }) => `v${row.original.template_version}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.status}
        label={assessmentStatusLabel(row.original.status)}
      />
    ),
  },
  {
    accessorKey: "submitted_at",
    header: "Submitted",
    cell: ({ row }) =>
      row.original.submitted_at
        ? new Date(row.original.submitted_at).toLocaleDateString()
        : "—",
  },
];

export function ReviewQueueTable({ rows }: { rows: ReviewQueueRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="vendor"
      searchPlaceholder="Search review queue..."
      onRowClick={(row) => router.push(`/assessments/${row.id}`)}
      emptyState={
        <EmptyState
          icon={ClipboardCheck}
          title="Review queue is clear"
          description="Submitted assessments will appear here."
        />
      }
    />
  );
}
