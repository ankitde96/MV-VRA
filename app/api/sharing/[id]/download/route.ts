import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { readSharedDocument } from "@/lib/services/sharing";

/**
 * The authorised proxy route for the cross-tenant read path (`CONSTRAINTS.md` #10's
 * discipline applied to the one sanctioned cross-tenant path, `CONSTRAINTS.md` #8) —
 * `readSharedDocument()` re-derives authorization from the share grant itself, never from a
 * client-supplied claim, and records an audit event on every call.
 */
export const GET = withRouteErrors<{ params: Promise<{ id: string }> }>(
  async (_request: NextRequest, context) => {
    const membership = await requireCurrentMembership();
    const { id } = await context.params;

    const { document, body } = await readSharedDocument(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
    );

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": document.mime,
        "Content-Disposition": `attachment; filename="${document.filename.replace(/"/g, "")}"`,
        "Content-Length": String(document.size),
      },
    });
  },
);
