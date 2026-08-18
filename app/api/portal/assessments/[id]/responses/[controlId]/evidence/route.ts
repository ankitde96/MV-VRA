import { NextResponse, type NextRequest } from "next/server";
import { getCurrentPortalSession } from "@/lib/auth/current-portal-session";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import { uploadEvidence } from "@/lib/services/portal-assessment";

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; controlId: string }> },
  ) => {
    const session = await getCurrentPortalSession();
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { id, controlId } = await params;
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!formData || !(file instanceof File)) {
      throw new ValidationError(
        'Expected multipart/form-data with a "file" field',
      );
    }

    const body = Buffer.from(await file.arrayBuffer());
    const evidence = await uploadEvidence(session, id, controlId, {
      filename: file.name,
      mime: file.type,
      body,
    });

    return NextResponse.json(
      {
        evidence: {
          id: evidence._id.toString(),
          filename: evidence.filename,
          mime: evidence.mime,
          size: evidence.size,
        },
      },
      { status: 201 },
    );
  },
);
