"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { assessmentStatusLabel } from "@/lib/assessments/status-label";

type HistoryRow = {
  assessment_id: string;
  status: string;
  template_name: string | null;
  template_version: number;
  sent_at: string | null;
  last_activity_at: string | null;
};

const columns: ColumnDef<HistoryRow>[] = [
  {
    id: "questionnaire",
    header: "Questionnaire",
    accessorFn: (row) =>
      `${row.template_name ?? "Assessment"} v${row.template_version}`,
  },
  {
    accessorKey: "sent_at",
    header: "Started",
    cell: ({ row }) => row.original.sent_at?.slice(0, 10) ?? "Not sent",
  },
  {
    accessorKey: "last_activity_at",
    header: "Last update",
    cell: ({ row }) => row.original.last_activity_at?.slice(0, 10) ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => assessmentStatusLabel(row.original.status),
  },
];

export function AssessmentHistoryList({ history }: { history: HistoryRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={history}
      onRowClick={(row) => router.push(`/assessments/${row.assessment_id}`)}
      emptyState={
        <p className="text-muted-foreground p-6 text-sm">No assessments yet.</p>
      }
    />
  );
}
