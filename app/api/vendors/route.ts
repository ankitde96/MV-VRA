import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { submitVendorIntake } from "@/lib/services/vendor-intake";

const intakeRequestSchema = z.object({
  legal_name: z.string().min(1),
  domain: z.string().min(1),
  spoc: z.object({
    spoc_name: z.string().min(1),
    spoc_email: z.string().email(),
    spoc_phone: z.string().min(1),
  }),
  business_unit: z.string().min(1),
  functional_scope: z.string().min(1),
  expected_procurement_date: z.coerce.date(),
  data_classification: z
    .array(z.enum(["pii", "phi", "financial", "none"]))
    .min(1),
  network_exposure: z.enum(["external", "internal", "none"]),
  system_access_level: z.enum(["admin", "write", "read", "none"]),
  business_redundancy: z.enum([
    "single_source",
    "some_redundancy",
    "fully_redundant",
  ]),
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  // proxy.ts already guarantees a valid session reached this handler — re-verifying here
  // is what makes workspace/actor scope derived from the session, never a request field
  // (the same discipline FLOW.md F2 requires of the vendor portal, applied here too).
  const membership =
    await requireCurrentMembershipWithCapability("vendor.write");

  const body = await request.json().catch(() => null);
  const parsed = intakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", message: parsed.error.message },
      { status: 422 },
    );
  }

  const { vendor, engagement } = await submitVendorIntake(
    { workspaceId: membership.workspaceId },
    { userId: membership.userId, workspaceId: membership.workspaceId },
    parsed.data,
  );

  return NextResponse.json(
    {
      vendor: {
        id: vendor._id.toString(),
        inherent_risk_tier: vendor.inherent_risk_tier,
      },
      engagement: {
        id: engagement._id.toString(),
        status: engagement.status,
        inherent_risk_tier: engagement.inherent_risk_tier,
      },
    },
    { status: 201 },
  );
});
