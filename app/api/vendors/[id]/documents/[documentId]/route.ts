import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { getVendorDocument } from "@/lib/services/vendor-documents";

/**
 * The "authorised proxy route" CONSTRAINTS.md #10 requires — a raw storage key is never
 * enough to retrieve a file. `getVendorDocument` re-derives authorization from the
 * session's workspace and this vendor's own document list; nothing here trusts a
 * client-supplied key.
 */
export const GET = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; documentId: string }> },
  ) => {
    const membership = await requireCurrentMembership();

    const { id, documentId } = await params;
    const { document, body } = await getVendorDocument(
      { workspaceId: membership.workspaceId },
      id,
      documentId,
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
