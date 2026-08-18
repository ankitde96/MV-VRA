"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { RiskTierBadge } from "@/components/domain/risk-tier-badge";
import { StatusBadge } from "@/components/domain/status-badge";
import { EmptyState } from "@/components/layout/empty-state";

export interface VendorRow {
  id: string;
  legal_name: string;
  domain: string;
  spoc_email: string;
  tier: number | null;
  engagement_status: string | null;
  lifecycle_status: string;
}

const columns: ColumnDef<VendorRow>[] = [
  {
    accessorKey: "legal_name",
    header: "Legal name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.legal_name}</span>
    ),
  },
  { accessorKey: "domain", header: "Domain" },
  { accessorKey: "spoc_email", header: "SPOC" },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => <RiskTierBadge tier={row.original.tier} />,
  },
  {
    accessorKey: "engagement_status",
    header: "Engagement status",
    cell: ({ row }) =>
      row.original.engagement_status ? (
        <StatusBadge status={row.original.engagement_status} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "lifecycle_status",
    header: "Lifecycle",
    cell: ({ row }) => <StatusBadge status={row.original.lifecycle_status} />,
  },
];

/**
 * `VendorInventoryTable` from DESIGN-SYSTEM.md §4 — sticky header, column sort, search,
 * column visibility (built into `DataTable`). Row click navigates to the vendor detail page,
 * same destination the legal-name link went to before this table existed.
 */
export function VendorsTable({ rows }: { rows: VendorRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No vendors yet"
        description="Start a new vendor intake to see it here."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchKey="legal_name"
      searchPlaceholder="Search vendors..."
      onRowClick={(row) => router.push(`/vendors/${row.id}`)}
    />
  );
}
