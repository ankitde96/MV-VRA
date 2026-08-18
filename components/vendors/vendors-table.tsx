"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  business_unit: string;
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
  { accessorKey: "business_unit", header: "Business unit" },
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
  const [tier, setTier] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No vendors yet"
        description="Start a new vendor intake to see it here."
      />
    );
  }

  const filtered = rows.filter(
    (row) =>
      (tier === "all" ||
        (tier === "unscored"
          ? row.tier === null
          : row.tier === Number(tier))) &&
      (lifecycle === "all" || row.lifecycle_status === lifecycle),
  );

  const chips = (
    values: Array<[string, string]>,
    selected: string,
    onSelect: (value: string) => void,
  ) => (
    <div className="flex flex-wrap gap-1" role="group">
      {values.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          className={
            selected === value
              ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              : "rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          }
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
        {chips(
          [
            ["all", "All tiers"],
            ["1", "Tier 1"],
            ["2", "Tier 2"],
            ["3", "Tier 3"],
            ["unscored", "Unscored"],
          ],
          tier,
          setTier,
        )}
        {chips(
          [
            ["all", "All lifecycle"],
            ["prospective", "Prospective"],
            ["active", "Active"],
            ["offboarding", "Offboarding"],
            ["terminated", "Terminated"],
          ],
          lifecycle,
          setLifecycle,
        )}
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        searchKey="legal_name"
        searchPlaceholder="Search vendors..."
        onRowClick={(row) => router.push(`/vendors/${row.id}`)}
      />
    </div>
  );
}
