import { NextResponse, type NextRequest } from "next/server";
import { getCurrentPortalSession } from "@/lib/auth/current-portal-session";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import {
  deleteEvidence,
  getEvidenceFile,
} from "@/lib/services/portal-assessment";

/**
 * Authorised proxy route (CONSTRAINTS.md #10) — `getEvidenceFile` re-derives authorization
 * from the session's vendor/workspace and this control's own evidence array, never a raw
 * key, same discipline as Phase 4's vendor-document download route.
 */
export const GET = withRouteErrors(
  async (
    request: NextRequest,
    {
      params,
    }: {
      params: Promise<{ id: string; controlId: string; evidenceId: string }>;
    },
  ) => {
    const session = await getCurrentPortalSession();
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { id, controlId, evidenceId } = await params;
    const { evidence, body } = await getEvidenceFile(
      session,
      id,
      controlId,
      evidenceId,
    );

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": evidence.mime,
        "Content-Disposition": `attachment; filename="${evidence.filename.replace(/"/g, "")}"`,
        "Content-Length": String(evidence.size),
      },
    });
  },
);

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 1 — lets a vendor remove a mistaken upload while the
 * assessment is still editable; `deleteEvidence()` re-derives authorization from the
 * session the same way the GET above does.
 */
export const DELETE = withRouteErrors(
  async (
    request: NextRequest,
    {
      params,
    }: {
      params: Promise<{ id: string; controlId: string; evidenceId: string }>;
    },
  ) => {
    const session = await getCurrentPortalSession();
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { id, controlId, evidenceId } = await params;
    const result = await deleteEvidence(session, id, controlId, evidenceId);
    return NextResponse.json(result);
  },
);
