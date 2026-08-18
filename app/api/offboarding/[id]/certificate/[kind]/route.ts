import { NextResponse, type NextRequest } from "next/server";
import {
  requireCurrentMembership,
  requireCurrentMembershipWithCapability,
} from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  getOffboardingCertificateFile,
  uploadOffboardingCertificate,
} from "@/lib/services/offboarding";
import type { CertificateKind } from "@/lib/repositories/offboarding-repository";

const VALID_KINDS = new Set([
  "destruction_certificate",
  "asset_return_attestation",
]);

function assertValidKind(kind: string): CertificateKind {
  if (!VALID_KINDS.has(kind)) {
    throw new ValidationError(
      "kind must be destruction_certificate or asset_return_attestation",
    );
  }
  return kind as CertificateKind;
}

export const POST = withRouteErrors(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; kind: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("offboarding.manage");

    const { id, kind } = await params;
    const validKind = assertValidKind(kind);

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!formData || !(file instanceof File)) {
      throw new ValidationError(
        'Expected multipart/form-data with a "file" field',
      );
    }

    const body = Buffer.from(await file.arrayBuffer());
    const certificate = await uploadOffboardingCertificate(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      validKind,
      { filename: file.name, mime: file.type, body },
    );

    return NextResponse.json({ certificate }, { status: 201 });
  },
);

export const GET = withRouteErrors(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; kind: string }> },
  ) => {
    const membership = await requireCurrentMembership();

    const { id, kind } = await params;
    const validKind = assertValidKind(kind);

    const { certificate, body } = await getOffboardingCertificateFile(
      { workspaceId: membership.workspaceId },
      id,
      validKind,
    );
    if (!certificate) throw new NotFoundError("Certificate not found");

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${validKind}"`,
      },
    });
  },
);
