import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/current-session";
import { dbConnect } from "@/lib/db/connect";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  VendorsTable,
  type VendorRow,
} from "@/components/vendors/vendors-table";

/**
 * Server Component, same direct-repository pattern the Phase 2 dashboard placeholder used
 * (no internal fetch round-trip for a read the Server Component can do itself).
 * Vendor <-> Engagement is joined in memory — no aggregation module exists yet, and the
 * volumes this MVP targets (PLAN.md A1) don't need one.
 */
export default async function VendorsPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  await dbConnect();
  const vendorRepo = new VendorRepository({ workspaceId: session.workspaceId });
  const engagementRepo = new EngagementRepository({
    workspaceId: session.workspaceId,
  });

  const [vendors, engagements] = await Promise.all([
    vendorRepo.find().sort({ created_at: -1 }).lean(),
    engagementRepo.find().lean(),
  ]);

  const latestEngagementByVendor = new Map<
    string,
    (typeof engagements)[number]
  >();
  for (const engagement of engagements) {
    const key = engagement.vendor_id.toString();
    const existing = latestEngagementByVendor.get(key);
    if (!existing || engagement.created_at > existing.created_at) {
      latestEngagementByVendor.set(key, engagement);
    }
  }

  const rows: VendorRow[] = vendors.map((vendor) => {
    const engagement = latestEngagementByVendor.get(vendor._id.toString());
    const activeSpocs = (vendor.spocs ?? []).filter(
      (s) => s.status === "active",
    );
    // ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — the primary spocs[] entry, falling back to the
    // legacy `spoc` object only for a vendor that predates this stage and hasn't been
    // migrated yet (scripts/migrate-vendor-spocs.ts backfills spocs[] for exactly this).
    const primarySpoc =
      activeSpocs.find((s) => s.is_primary) ?? activeSpocs[0] ?? null;
    return {
      id: vendor._id.toString(),
      legal_name: vendor.legal_name,
      domain: vendor.domain,
      spoc_email:
        primarySpoc?.email ?? vendor.spoc?.spoc_email ?? "No active SPOC",
      spoc_count:
        activeSpocs.length > 0 ? activeSpocs.length : vendor.spoc ? 1 : 0,
      business_unit: vendor.business_unit ?? "Unassigned",
      tier: vendor.inherent_risk_tier ?? null,
      engagement_status: engagement?.status ?? null,
      lifecycle_status: vendor.lifecycle_status,
    };
  });

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Every vendor engagement in this workspace."
        actions={
          <Button render={<Link href="/vendors/new" />}>New intake</Button>
        }
      />
      <VendorsTable rows={rows} />
    </div>
  );
}
