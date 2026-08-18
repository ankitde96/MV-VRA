import { dbConnect } from "@/lib/db/connect";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import {
  Assessment,
  Engagement,
  Offboarding,
  OtpChallenge,
  QuestionnaireTemplate,
  Response,
  Risk,
  SharedDocument,
  Vendor,
} from "@/lib/db/models";
import { NotFoundError, ValidationError } from "@/lib/errors";

const DEFAULT_SETTINGS = {
  risk_weights: {
    data_classification: { pii: 30, phi: 30, financial: 20, none: 0 },
    network_exposure: { external: 25, internal: 10, none: 0 },
    system_access_level: { admin: 25, write: 15, read: 5, none: 0 },
    business_redundancy: {
      single_source: 20,
      some_redundancy: 10,
      fully_redundant: 0,
    },
  },
  weights_version: 1,
  tier_thresholds: { tier1_min: 70, tier2_min: 40 },
  enterprise_risk_categories: [] as string[],
};

export interface WorkspaceInput {
  entityName: string;
  slug: string;
  status?: "active" | "suspended";
}

export async function listWorkspaces() {
  await dbConnect();
  const workspaces = await Workspace.find().sort({ entity_name: 1 }).lean();
  return workspaces.map((workspace) => ({
    workspace_id: workspace._id.toString(),
    entity_name: workspace.entity_name,
    slug: workspace.slug,
    status: workspace.status,
  }));
}

export async function createWorkspace(
  input: WorkspaceInput,
  actorUserId: string,
) {
  await dbConnect();
  const slug = normalizeSlug(input.slug);
  if (await Workspace.exists({ slug })) {
    throw new ValidationError("A workspace with this slug already exists");
  }
  const workspace = await Workspace.create({
    entity_name: input.entityName.trim(),
    slug,
    settings: DEFAULT_SETTINGS,
    status: input.status ?? "active",
  });
  await User.updateOne(
    { _id: actorUserId },
    { $push: { memberships: { workspace_id: workspace._id, role: "admin" } } },
  );
  return toWorkspaceItem(workspace);
}

export async function updateWorkspace(id: string, input: WorkspaceInput) {
  await dbConnect();
  const slug = normalizeSlug(input.slug);
  if (await Workspace.exists({ slug, _id: { $ne: id } })) {
    throw new ValidationError("A workspace with this slug already exists");
  }
  const workspace = await Workspace.findByIdAndUpdate(
    id,
    {
      $set: {
        entity_name: input.entityName.trim(),
        slug,
        status: input.status ?? "active",
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!workspace) throw new NotFoundError("Workspace not found");
  return toWorkspaceItem(workspace);
}

export async function deleteWorkspace(id: string, currentWorkspaceId: string) {
  if (id === currentWorkspaceId) {
    throw new ValidationError(
      "Switch to another workspace before deleting the current workspace",
    );
  }
  await dbConnect();
  const workspace = await Workspace.findById(id);
  if (!workspace) throw new NotFoundError("Workspace not found");

  // Audit events remain append-only after deletion. Stored evidence is intentionally left
  // for the existing orphan-evidence sweep to remove from local/S3 storage safely.
  await Promise.all([
    Assessment.deleteMany({ workspace_id: workspace._id }),
    Engagement.deleteMany({ workspace_id: workspace._id }),
    Offboarding.deleteMany({ workspace_id: workspace._id }),
    OtpChallenge.deleteMany({ workspace_id: workspace._id }),
    QuestionnaireTemplate.deleteMany({ workspace_id: workspace._id }),
    Response.deleteMany({ workspace_id: workspace._id }),
    Risk.deleteMany({ workspace_id: workspace._id }),
    Vendor.deleteMany({ workspace_id: workspace._id }),
    SharedDocument.deleteMany({ owner_workspace_id: workspace._id }),
    SharedDocument.updateMany(
      { shared_with: workspace._id },
      { $pull: { shared_with: workspace._id } },
    ),
    User.updateMany(
      {},
      { $pull: { memberships: { workspace_id: workspace._id } } },
    ),
    Workspace.updateMany(
      { parent_workspace_id: workspace._id },
      { $set: { parent_workspace_id: null } },
    ),
  ]);
  await workspace.deleteOne();
  return { workspace_id: id, deleted: true };
}

function normalizeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ValidationError(
      "Slug must contain lowercase letters, numbers, and single hyphens only",
    );
  }
  return slug;
}

function toWorkspaceItem(workspace: {
  _id: { toString(): string };
  entity_name: string;
  slug: string;
  status: "active" | "suspended";
}) {
  return {
    workspace_id: workspace._id.toString(),
    entity_name: workspace.entity_name,
    slug: workspace.slug,
    status: workspace.status,
  };
}
