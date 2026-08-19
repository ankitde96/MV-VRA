import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { dbConnect } from "@/lib/db/connect";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { EngagementRepository } from "@/lib/repositories/engagement-repository";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { TemplateRepository } from "@/lib/repositories/template-repository";
import { getOffboardingView } from "@/lib/services/offboarding";
import { getVendorScorecard } from "@/lib/services/analytics";
import { SpocEditForm } from "@/components/spoc-edit-form";
import { VendorDocumentUpload } from "@/components/vendor-document-upload";
import { AssignAssessmentForm } from "@/components/assessments/assign-assessment-form";
import { OffboardingPanel } from "@/components/offboarding/offboarding-panel";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBreakdown } from "@/components/domain/score-breakdown";
import { AssessmentHistoryList } from "@/components/domain/assessment-history-list";
import { RiskTierBadge } from "@/components/domain/risk-tier-badge";
import { CalendarClock, ClipboardList, FileCheck } from "lucide-react";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

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
      templateName: a.template_name ?? `Assessment`,
      templateSnapshot: a.template_snapshot as unknown as QuestionsSchema,
      updatedAt: a.updated_at.toISOString(),
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
  const [offboardingByEngagement, scorecard] = await Promise.all([
    Promise.all(
      engagements.map(
        async (e) =>
          [
            e._id.toString(),
            await getOffboardingView(ctx, e._id.toString()),
          ] as const,
      ),
    ).then((entries) => new Map(entries)),
    getVendorScorecard(ctx, id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={vendor.legal_name}
        description={vendor.domain}
        actions={
          <RiskTierBadge
            tier={vendor.inherent_risk_tier ?? null}
            scoringFailed={vendor.inherent_risk_tier == null}
          />
        }
      />

      {/* UI Revamp Round 2 Phase E (docs/UI-REVAMP-2-PLAN.md, DECISIONS.md 028/029) — the
          per-vendor risk scorecard §4 spec'd for Round 1 Phase 3 and never built. */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          Risk scorecard
        </h2>
        <ScoreBreakdown
          inherentScore={scorecard.inherent_score}
          residualTotal={scorecard.residual_total}
          reductionPercent={scorecard.reduction_percent}
          openRiskBySeverity={scorecard.open_risk_by_severity}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card className="rounded-lg border bg-card shadow-none">
            <CardContent className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Reassessment due
                </p>
                <p
                  className={
                    scorecard.reassessment_overdue
                      ? "text-risk-critical mt-1 text-2xl font-semibold"
                      : "mt-1 text-2xl font-semibold"
                  }
                >
                  {scorecard.next_review_due
                    ? scorecard.next_review_due.slice(0, 10)
                    : "—"}
                </p>
                {!scorecard.next_review_due ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Not yet reviewed
                  </p>
                ) : scorecard.reassessment_overdue ? (
                  <p className="text-risk-critical mt-1 text-xs">Overdue</p>
                ) : null}
              </div>
              <CalendarClock
                className={
                  scorecard.reassessment_overdue
                    ? "text-risk-critical size-5 shrink-0"
                    : "text-foreground size-5 shrink-0 opacity-40"
                }
                aria-hidden="true"
              />
            </CardContent>
          </Card>
          <StatCard
            label="CAP tasks"
            value={scorecard.cap_tasks.open + scorecard.cap_tasks.overdue}
            hint={
              scorecard.cap_tasks.overdue > 0
                ? `${scorecard.cap_tasks.overdue} overdue`
                : `${scorecard.cap_tasks.closed} closed`
            }
            icon={<ClipboardList />}
            tone={scorecard.cap_tasks.overdue > 0 ? "critical" : "default"}
          />
          <StatCard
            label="Evidence coverage"
            value={Math.round(scorecard.evidence_coverage_percent ?? 0)}
            hint={
              scorecard.evidence_coverage_percent !== null
                ? "% of answers with evidence attached"
                : "No answered questions yet"
            }
            icon={<FileCheck />}
            tone={
              scorecard.evidence_coverage_percent !== null &&
              scorecard.evidence_coverage_percent < 50
                ? "medium"
                : "default"
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          Assessment history
        </h2>
        <AssessmentHistoryList history={scorecard.assessment_history} />
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Open risks</h2>
        {scorecard.open_risks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No open risks.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {scorecard.open_risks.map((risk) => (
              <div
                key={risk.id}
                className="flex items-center justify-between gap-4 p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{risk.title}</p>
                  <p className="text-muted-foreground text-xs capitalize">
                    {risk.severity} · {risk.status}
                  </p>
                </div>
                <span className="font-mono font-semibold">
                  {risk.residual_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Vendor SPOCs</h2>
        <SpocEditForm
          vendorId={id}
          initialSpocs={(vendor.spocs ?? []).map((spoc) => ({
            id: spoc._id!.toString(),
            name: spoc.name,
            email: spoc.email,
            phone: spoc.phone,
            is_primary: spoc.is_primary ?? false,
            status: spoc.status ?? "active",
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Documents</h2>
        <VendorDocumentUpload vendorId={id} documents={documents} />
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          Questionnaires
        </h2>
        <AssignAssessmentForm
          vendorId={id}
          engagements={engagementRows}
          publishedTemplates={publishedTemplateOptions}
          recipients={(vendor.spocs ?? [])
            .filter((spoc) => spoc.status === "active")
            .map((spoc) => ({
              id: spoc._id!.toString(),
              name: spoc.name,
              email: spoc.email,
              phone: spoc.phone,
            }))}
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
