import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { dbConnect } from "@/lib/db/connect";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { TemplateRepository } from "@/lib/repositories/template-repository";
import { getOffboardingView } from "@/lib/services/offboarding";
import { SpocEditForm } from "@/components/spoc-edit-form";
import { VendorDocumentUpload } from "@/components/vendor-document-upload";
import { AssignAssessmentForm } from "@/components/assessments/assign-assessment-form";
import { OffboardingPanel } from "@/components/offboarding/offboarding-panel";

/**
 * PLAN.md Phase 4, spec §2.1 — SPOC management "within the vendor details page." Same
 * direct-repository Server Component pattern as app/(internal)/vendors/page.tsx.
 */
export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) return null;

  const { id } = await params;

  await dbConnect();
  const vendorRepo = new VendorRepository({ workspaceId: session.workspaceId });
  const vendor = await vendorRepo.findById(id).lean();
  if (!vendor) notFound();

  const documents = vendor.documents.map((doc) => ({
    id: doc._id!.toString(),
    filename: doc.filename,
    mime: doc.mime,
    size: doc.size,
    uploaded_at: doc.uploaded_at.toISOString(),
  }));

  const engagementRepo = new EngagementRepository({
    workspaceId: session.workspaceId,
  });
  const assessmentRepo = new AssessmentRepository({
    workspaceId: session.workspaceId,
  });
  const templateRepo = new TemplateRepository({
    workspaceId: session.workspaceId,
  });

  const [engagements, assessments, publishedTemplates] = await Promise.all([
    engagementRepo.find({ vendor_id: vendor._id }).lean(),
    assessmentRepo.find({ vendor_id: vendor._id }).lean(),
    templateRepo
      .find({ status: "published" })
      .sort({ template_key: 1, version: -1 })
      .lean(),
  ]);

  const assessmentsByEngagement = new Map<string, typeof assessments>();
  for (const assessment of assessments) {
    const key = assessment.engagement_id.toString();
    assessmentsByEngagement.set(key, [
      ...(assessmentsByEngagement.get(key) ?? []),
      assessment,
    ]);
  }

  // One row per template_key — its highest-versioned *published* row, since assigning an
  // older published version deliberately isn't offered here (PLAN.md doesn't call for it,
  // and it would need its own affordance to be a real feature rather than a footgun).
  const latestPublishedByKey = new Map<
    string,
    (typeof publishedTemplates)[number]
  >();
  for (const template of publishedTemplates) {
    if (!latestPublishedByKey.has(template.template_key)) {
      latestPublishedByKey.set(template.template_key, template);
    }
  }

  const engagementRows = engagements.map((engagement) => ({
    id: engagement._id.toString(),
    businessUnit: engagement.business_unit,
    status: engagement.status,
    assessments: (
      assessmentsByEngagement.get(engagement._id.toString()) ?? []
    ).map((a) => ({
      id: a._id.toString(),
      status: a.status,
      templateVersion: a.template_version,
    })),
  }));

  const publishedTemplateOptions = [...latestPublishedByKey.values()].map(
    (t) => ({
      id: t._id.toString(),
      name: t.name,
      templateKey: t.template_key,
      version: t.version,
    }),
  );

  const ctx = { workspaceId: session.workspaceId };
  const offboardingByEngagement = new Map(
    await Promise.all(
      engagements.map(
        async (e) =>
          [
            e._id.toString(),
            await getOffboardingView(ctx, e._id.toString()),
          ] as const,
      ),
    ),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-lg font-semibold">
          {vendor.legal_name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{vendor.domain}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Vendor SPOC</h2>
        <SpocEditForm vendorId={id} initialSpoc={vendor.spoc} />
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Documents</h2>
        <VendorDocumentUpload vendorId={id} documents={documents} />
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Assessments</h2>
        <AssignAssessmentForm
          vendorId={id}
          engagements={engagementRows}
          publishedTemplates={publishedTemplateOptions}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Offboarding</h2>
        {engagements.length === 0 ? (
          <p className="text-muted-foreground text-sm">No engagements yet.</p>
        ) : (
          <div className="space-y-4">
            {engagements.map((engagement) => (
              <OffboardingPanel
                key={engagement._id.toString()}
                vendorId={id}
                engagementId={engagement._id.toString()}
                engagementLabel={`${engagement.business_unit} (${engagement.status})`}
                engagementEligible={
                  !["offboarding", "closed"].includes(engagement.status)
                }
                offboarding={
                  offboardingByEngagement.get(engagement._id.toString()) ?? null
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
