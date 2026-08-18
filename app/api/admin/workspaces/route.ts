import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import {
  createWorkspace,
  listWorkspaces,
} from "@/lib/services/admin-workspaces";

const workspaceSchema = z.object({
  entity_name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  status: z.enum(["active", "suspended"]).optional(),
});

export const GET = withRouteErrors(async () => {
  await requireSuperAdmin();
  return NextResponse.json({ workspaces: await listWorkspaces() });
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  const actor = await requireSuperAdmin();
  const parsed = workspaceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) throw new ValidationError("Name and slug are required");
  const workspace = await createWorkspace(
    {
      entityName: parsed.data.entity_name,
      slug: parsed.data.slug,
      status: parsed.data.status,
    },
    actor.userId,
  );
  return NextResponse.json(workspace, { status: 201 });
});
