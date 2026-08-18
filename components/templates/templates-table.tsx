"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileStack } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/domain/status-badge";
import { EmptyState } from "@/components/layout/empty-state";

export interface TemplateRow {
  id: string;
  name: string;
  template_key: string;
  version: number;
  status: string;
}

const columns: ColumnDef<TemplateRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  { accessorKey: "template_key", header: "Template key" },
  {
    accessorKey: "version",
    header: "Latest version",
    cell: ({ row }) => `v${row.original.version}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export function TemplatesTable({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileStack}
        title="No templates yet"
        description="Create a questionnaire template to start assigning assessments."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="name"
      searchPlaceholder="Search templates..."
      onRowClick={(row) => router.push(`/templates/${row.id}`)}
    />
  );
}
