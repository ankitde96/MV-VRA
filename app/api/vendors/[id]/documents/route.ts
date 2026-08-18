import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import { uploadVendorDocument } from "@/lib/services/vendor-documents";

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("vendor.write");

    const { id } = await params;
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!formData || !(file instanceof File)) {
      throw new ValidationError(
        'Expected multipart/form-data with a "file" field',
      );
    }

    const body = Buffer.from(await file.arrayBuffer());
    const document = await uploadVendorDocument(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      { filename: file.name, mime: file.type, body },
    );

    return NextResponse.json(
      {
        document: {
          id: document._id.toString(),
          filename: document.filename,
          mime: document.mime,
          size: document.size,
        },
      },
      { status: 201 },
    );
  },
);
