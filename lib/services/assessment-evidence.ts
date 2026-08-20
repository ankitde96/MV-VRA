import { PassThrough, Readable } from "node:stream";
import { extname } from "node:path";
import { ZipArchive, type ArchiverError } from "archiver";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { ResponseRepository } from "@/lib/repositories/response-repository";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { User } from "@/lib/db/models/user";
import { getStorageDriver, type StorageDriver } from "@/lib/storage";
import { env } from "@/lib/env";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

export interface EvidenceFlagInput {
  flag: "insufficient" | null;
  note?: string;
}

export interface AssessmentEvidenceArchive {
  stream: ReadableStream<Uint8Array>;
  filename: string;
  fileCount: number;
  sourceBytes: number;
}

interface ArchiveEntry {
  path: string;
  fileKey: string;
  controlId: string;
  filename: string;
  uploader: string;
  uploadedAt: Date;
  insufficient: boolean;
  flagNote: string;
}

function sanitizeArchiveSegment(value: string, fallback: string): string {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 100);
  return sanitized || fallback;
}

function withCollisionSuffix(path: string, count: number): string {
  if (count === 1) return path;
  const extension = extname(path);
  const stem = extension ? path.slice(0, -extension.length) : path;
  return `${stem}-${count}${extension}`;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildEvidenceManifest(entries: ArchiveEntry[]): string {
  const rows = [
    [
      "control_id",
      "filename",
      "uploader",
      "uploaded_at",
      "insufficient",
      "insufficiency_note",
    ],
    ...entries.map((entry) => [
      entry.controlId,
      entry.filename,
      entry.uploader,
      entry.uploadedAt.toISOString(),
      entry.insufficient ? "yes" : "no",
      entry.flagNote,
    ]),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export class AssessmentEvidenceService {
  private assessmentRepo: AssessmentRepository;
  private responseRepo: ResponseRepository;
  private vendorRepo: VendorRepository;

  constructor(
    private ctx: TenantContext,
    private storage: StorageDriver = getStorageDriver(),
  ) {
    this.assessmentRepo = new AssessmentRepository(ctx);
    this.responseRepo = new ResponseRepository(ctx);
    this.vendorRepo = new VendorRepository(ctx);
  }

  async getEvidenceFile(
    assessmentId: string,
    controlId: string,
    evidenceId: string,
  ) {
    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    }
    const response = await this.responseRepo
      .findOneByControl(assessmentId, controlId)
      .lean();
    const evidence = response?.evidence.find(
      (item) => item._id?.toString() === evidenceId,
    );
    if (!evidence) {
      throw new NotFoundError(`Evidence ${evidenceId} not found`);
    }
    const body = await this.storage.get(evidence.file_key);
    return { evidence, body };
  }

  async setEvidenceFlag(
    assessmentId: string,
    controlId: string,
    evidenceId: string,
    input: EvidenceFlagInput,
    actorId: string,
  ) {
    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    }
    if (!["submitted", "under_review"].includes(assessment.status)) {
      throw new ForbiddenError(
        "Evidence can only be annotated while an assessment is under review",
      );
    }

    const note = input.note?.trim() ?? "";
    const nextFlag =
      input.flag === "insufficient"
        ? {
            evidence_id: toObjectId(evidenceId),
            flag: "insufficient" as const,
            note,
            flagged_at: new Date(),
            flagged_by: toObjectId(actorId),
          }
        : null;
    const response = await this.responseRepo.setEvidenceFlag(
      assessmentId,
      controlId,
      evidenceId,
      nextFlag,
    );
    if (!response) {
      throw new NotFoundError(`Evidence ${evidenceId} not found`);
    }

    await recordAuditEvent({
      workspace_id: toObjectId(this.ctx.workspaceId),
      actor: { type: "internal", id: toObjectId(actorId), email: null },
      action: input.flag
        ? "assessment.evidence_flagged"
        : "assessment.evidence_flag_cleared",
      entity_type: "Response",
      entity_id: response._id,
      diff: {
        control_id: controlId,
        evidence_id: evidenceId,
        flag: input.flag,
        note,
      },
    });

    return {
      flag: nextFlag
        ? {
            flag: nextFlag.flag,
            note: nextFlag.note,
            flagged_at: nextFlag.flagged_at.toISOString(),
          }
        : null,
    };
  }

  async createArchive(
    assessmentId: string,
    maxBytes = env.EVIDENCE_ZIP_MAX_BYTES,
  ): Promise<AssessmentEvidenceArchive> {
    const assessment = await this.assessmentRepo.findById(assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError(`Assessment not found: ${assessmentId}`);
    }
    const [responses, vendor] = await Promise.all([
      this.responseRepo.findByAssessment(assessmentId).lean(),
      this.vendorRepo.findById(assessment.vendor_id).lean(),
    ]);
    if (!vendor) {
      throw new NotFoundError(
        `Vendor not found for assessment: ${assessmentId}`,
      );
    }

    const sourceBytes = responses.reduce(
      (total, response) =>
        total + response.evidence.reduce((sum, item) => sum + item.size, 0),
      0,
    );
    const fileCount = responses.reduce(
      (total, response) => total + response.evidence.length,
      0,
    );
    if (fileCount === 0) {
      throw new ValidationError("This assessment has no evidence to export");
    }
    if (sourceBytes > maxBytes) {
      throw new ValidationError(
        `Evidence export is ${sourceBytes} bytes and exceeds the ${maxBytes}-byte limit`,
      );
    }

    const uploaderLabels = new Map<string, string>([
      [vendor._id.toString(), vendor.legal_name],
      ...vendor.spocs.map(
        (spoc) => [spoc._id.toString(), spoc.name] as [string, string],
      ),
    ]);
    const unresolvedUploaderIds = [
      ...new Map(
        responses
          .flatMap((response) => response.evidence)
          .filter(
            (evidence) => !uploaderLabels.has(evidence.uploaded_by.toString()),
          )
          .map((evidence) => [
            evidence.uploaded_by.toString(),
            evidence.uploaded_by,
          ]),
      ).values(),
    ];
    if (unresolvedUploaderIds.length > 0) {
      const users = await User.find({
        _id: { $in: unresolvedUploaderIds },
        memberships: {
          $elemMatch: { workspace_id: toObjectId(this.ctx.workspaceId) },
        },
      })
        .select({ _id: 1, name: 1 })
        .lean();
      for (const user of users) {
        uploaderLabels.set(user._id.toString(), user.name);
      }
    }

    const sectionByControl = new Map<string, string>();
    const schema = assessment.template_snapshot as QuestionsSchema;
    for (const section of schema.sections) {
      for (const question of section.questions) {
        sectionByControl.set(question.control_id, section.title);
      }
    }

    const pathCounts = new Map<string, number>();
    const entries: ArchiveEntry[] = [];
    for (const response of responses) {
      for (const evidence of response.evidence) {
        const section = sanitizeArchiveSegment(
          sectionByControl.get(response.control_id) ?? "Other",
          "Other",
        );
        const controlId = sanitizeArchiveSegment(
          response.control_id,
          "control",
        );
        const filename = sanitizeArchiveSegment(evidence.filename, "evidence");
        const basePath = `${section}/${controlId}/${filename}`;
        const count = (pathCounts.get(basePath) ?? 0) + 1;
        pathCounts.set(basePath, count);
        const flag = response.evidence_flags.find(
          (item) =>
            item.evidence_id.toString() === evidence._id?.toString() &&
            item.flag === "insufficient",
        );
        entries.push({
          path: withCollisionSuffix(basePath, count),
          fileKey: evidence.file_key,
          controlId: response.control_id,
          filename: evidence.filename,
          uploader:
            uploaderLabels.get(evidence.uploaded_by.toString()) ??
            "Unknown uploader",
          uploadedAt: evidence.uploaded_at,
          insufficient: Boolean(flag),
          flagNote: flag?.note ?? "",
        });
      }
    }

    const bodies = await Promise.all(
      entries.map((entry) => this.storage.get(entry.fileKey)),
    );
    const output = new PassThrough();
    const zip = new ZipArchive({ zlib: { level: 9 } });
    zip.on("error", (error: ArchiverError) => output.destroy(error));
    zip.pipe(output);
    entries.forEach((entry, index) => {
      zip.append(bodies[index]!, { name: entry.path });
    });
    zip.append(buildEvidenceManifest(entries), { name: "manifest.csv" });
    void zip
      .finalize()
      .catch((error: unknown) => output.destroy(error as Error));

    return {
      stream: Readable.toWeb(output) as ReadableStream<Uint8Array>,
      filename: `${sanitizeArchiveSegment(vendor.legal_name, "assessment")}-evidence.zip`,
      fileCount,
      sourceBytes,
    };
  }
}
