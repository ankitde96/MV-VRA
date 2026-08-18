import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getCurrentSession } from "@/lib/auth/current-session";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import {
  deleteWorkspace,
  updateWorkspace,
} from "@/lib/services/admin-workspaces";

const workspaceSchema = z.object({
  entity_name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  status: z.enum(["active", "suspended"]),
});

export const PATCH = withRouteErrors<{ params: Promise<{ id: string }> }>(
  async (request: NextRequest, context) => {
    await requireSuperAdmin();
    const parsed = workspaceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      throw new ValidationError("Name, slug, and status are required");
    const { id } = await context.params;
    return NextResponse.json(
      await updateWorkspace(id, {
        entityName: parsed.data.entity_name,
        slug: parsed.data.slug,
        status: parsed.data.status,
      }),
    );
  },
);

export const DELETE = withRouteErrors<{ params: Promise<{ id: string }> }>(
  async (_request: NextRequest, context) => {
    await requireSuperAdmin();
    const session = await getCurrentSession();
    const { id } = await context.params;
    return NextResponse.json(await deleteWorkspace(id, session!.workspaceId));
  },
);
