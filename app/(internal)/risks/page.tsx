import { getCurrentSession } from "@/lib/auth/current-session";
import { dbConnect } from "@/lib/db/connect";
import { AssessmentReviewService } from "@/lib/services/assessment-review";
import { RiskRegisterClient } from "@/components/risks/risk-register-client";

export default async function RiskRegisterPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  await dbConnect();
  const service = new AssessmentReviewService({
    workspaceId: session.workspaceId,
  });
  const data = await service.listWorkspaceRisks();

  return (
    <RiskRegisterClient
      initialRisks={data.risks}
      categories={data.enterprise_risk_categories}
      isProvisionalTaxonomy={data.is_provisional_taxonomy}
    />
  );
}
