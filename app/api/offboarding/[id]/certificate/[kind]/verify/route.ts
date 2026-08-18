import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import { verifyOffboardingCertificate } from "@/lib/services/offboarding";
import type { CertificateKind } from "@/lib/repositories/offboarding-repository";

const VALID_KINDS = new Set([
  "destruction_certificate",
  "asset_return_attestation",
]);

export const PATCH = withRouteErrors(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; kind: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("offboarding.manage");

    const { id, kind } = await params;
    if (!VALID_KINDS.has(kind)) {
      throw new ValidationError(
        "kind must be destruction_certificate or asset_return_attestation",
      );
    }

    const result = await verifyOffboardingCertificate(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      kind as CertificateKind,
    );

    return NextResponse.json(result);
  },
);
