import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import {
  setPrimaryVendorSpoc,
  setVendorSpocStatus,
  updateVendorSpocFields,
} from "@/lib/services/vendor-spoc";

const patchSpocRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    make_primary: z.literal(true).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.status !== undefined ||
      body.make_primary !== undefined,
    { message: "No updatable fields provided" },
  );

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — one PATCH endpoint for editing a SPOC's own
 * fields, deactivating/reactivating it, and/or making it primary, applied in that order.
 * Deliberately no DELETE: a SPOC is deactivated (soft), never hard-deleted — Stage 4's
 * `Assessment.recipients[]` will reference SPOC ids, so a hard delete would leave a
 * dangling reference (`DECISIONS.md` 042).
 */
export const PATCH = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; spocId: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("vendor.write");

    const { id, spocId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = patchSpocRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const ctx = { workspaceId: membership.workspaceId };
    const actor = { userId: membership.userId };
    const { name, email, phone, status, make_primary } = parsed.data;

    const fields: Partial<{ name: string; email: string; phone: string }> = {};
    if (name !== undefined) fields.name = name;
    if (email !== undefined) fields.email = email;
    if (phone !== undefined) fields.phone = phone;
    if (Object.keys(fields).length > 0) {
      await updateVendorSpocFields(ctx, actor, id, spocId, fields);
    }
    if (status !== undefined) {
      await setVendorSpocStatus(ctx, actor, id, spocId, status);
    }
    if (make_primary) {
      await setPrimaryVendorSpoc(ctx, actor, id, spocId);
    }

    return NextResponse.json({ ok: true });
  },
);
