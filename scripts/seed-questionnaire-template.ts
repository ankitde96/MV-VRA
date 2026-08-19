/**
 * Seeds the WFPL Vendor Risk Assessment Questionnaire v2.0 as a published
 * `QuestionnaireTemplate`, ready to assign to any engagement — no manual template-builder
 * work needed on a fresh dev environment. Source of truth is the checked-in CSV
 * (`docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv`, the client-provided
 * questionnaire, copied verbatim); this script is the only thing that ever reads it.
 *
 * Every question requires an evidence attachment and is `single_select` Yes/No by default,
 * per explicit direction — except the
 * 5 questions in `TEXT_TYPE_QUESTION_NUMBERS` below that are genuinely open-ended (e.g.
 * "Provide the vendor's name, registered address, and contact details") and get `type:
 * "text"` instead, per a follow-up direction correcting the all-Yes/No default for exactly
 * those. Everything else that merely *reads* like a statement rather than a question (e.g.
 * "Documented Change Management policy and procedures.") is still a genuine Yes/No
 * checklist confirmation and stays that way — see `TEXT_TYPE_QUESTION_NUMBERS`'s own
 * comment for how the 5 were identified and why the rest weren't included.
 *
 * The source CSV's "Evidence Required" column goes into `Question.evidence_hint`
 * (`lib/questionnaire/schema.ts`) — a dedicated field, not folded into the question's own
 * `text` (an earlier version of this script did that; corrected on request). Every question
 * has the field available; it's simply left unset when the source cell is blank, and the
 * shared `QuestionLabel` renderer shows nothing at all in that case — no empty hint line.
 *
 * Idempotent by `template_key` — a second run finds the existing template and exits without
 * creating a duplicate or a new version; it does NOT update an already-published template in
 * place (CONSTRAINTS.md #11 — publishing freezes it). If the source CSV changes, bump
 * `TEMPLATE_KEY`'s version by hand or use the app's own "create new version" flow.
 */
import { readFileSync } from "fs";
import { join } from "path";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { env } from "@/lib/env";
import { Workspace } from "@/lib/db/models/workspace";
import { User } from "@/lib/db/models/user";
import { TemplateRepository } from "@/lib/repositories/template-repository";
import { validateQuestionsSchemaStructure } from "@/lib/questionnaire/validate-schema";
import {
  createTemplate,
  publishTemplate,
} from "@/lib/services/questionnaire-templates";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

const CSV_PATH = join(
  __dirname,
  "../docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv",
);
const TEMPLATE_KEY = "wfpl-vendor-risk-assessment-v2";
const TEMPLATE_NAME = "WFPL Vendor Risk Assessment Questionnaire v2.0";

/**
 * Minimal RFC4180 CSV parser — no dependency added for a one-shot bootstrap script
 * (CONSTRAINTS.md #1). Handles quoted fields, embedded commas, embedded newlines, and `""`
 * escaped quotes, which the source file uses throughout (several evidence/question cells
 * span multiple lines inside one quoted field).
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "section"
  );
}

/**
 * The 5 questions (by 1-indexed position across the whole questionnaire, matching the
 * `questionNumber` counter below — i.e. `WFPL-001`, `WFPL-002`, `WFPL-003`, `WFPL-027`,
 * `WFPL-110`) that are genuinely open-ended and get `type: "text"` instead of the Yes/No
 * default: "Provide the vendor's name, registered address, and contact details.",
 * "Contact details of Primary point of Contact and Secondary Point of Contact...",
 * "What is the organizational structure of your company?", "How often is the risk
 * register reviewed and updated?", "How are compliance questionnaires shared and tracked
 * with third-party vendors?". Found by grepping the source for question text that doesn't
 * start with a yes/no auxiliary (Are/Is/Do/Does/Have/Can/...) and hand-checking each hit —
 * most of those hits (e.g. "Documented Change Management policy and procedures.",
 * "Code reviews are performed before deployment.") are still genuine Yes/No checklist
 * confirmations, just phrased as declarative statements rather than questions ("[Do you
 * have a] documented..."); only these 5 ask for a value a Yes/No can't express.
 */
const TEXT_TYPE_QUESTION_NUMBERS = new Set([1, 2, 3, 27, 110]);

/**
 * Walks the parsed CSV and builds the questions_schema. A row is a section header when
 * column 0 (S.No) is blank and column 1 (question text) is non-blank; a row is a question
 * when column 0 is non-blank. Everything else (fully blank rows — the CSV has hundreds of
 * trailing blank rows, and the header row itself) is skipped. `S.No` is not used as the
 * control_id — the source data has it going -2, -1, 0, 1, 6, 7... (broken/non-sequential),
 * so control_ids are generated fresh, sequentially, guaranteed unique.
 */
function buildSchemaFromCsv(rows: string[][]): QuestionsSchema {
  const sections: QuestionsSchema["sections"] = [];
  let currentSection: QuestionsSchema["sections"][number] | null = null;
  let questionNumber = 0;
  const usedSectionIds = new Set<string>();

  for (const row of rows.slice(1)) {
    const sno = (row[0] ?? "").trim();
    const questionText = (row[1] ?? "").trim().replace(/\s*\n\s*/g, " ");
    const evidenceText = (row[2] ?? "").trim().replace(/\s*\n\s*/g, " ");

    if (!questionText) continue; // fully blank row

    if (!sno) {
      // Section header row.
      let sectionId = slugify(questionText);
      let suffix = 2;
      while (usedSectionIds.has(sectionId)) {
        sectionId = `${slugify(questionText)}_${suffix}`;
        suffix += 1;
      }
      usedSectionIds.add(sectionId);
      currentSection = { id: sectionId, title: questionText, questions: [] };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      throw new Error(
        `Question row found before any section header: "${questionText.slice(0, 60)}"`,
      );
    }

    questionNumber += 1;
    const controlId = `WFPL-${String(questionNumber).padStart(3, "0")}`;
    const isTextType = TEXT_TYPE_QUESTION_NUMBERS.has(questionNumber);
    const evidenceHint = evidenceText || undefined;

    currentSection.questions.push(
      isTextType
        ? {
            control_id: controlId,
            text: questionText,
            type: "text",
            required: true,
            evidence: { required: true },
            evidence_hint: evidenceHint,
          }
        : {
            control_id: controlId,
            text: questionText,
            type: "single_select",
            options: ["Yes", "No"],
            required: true,
            evidence: { required: true },
            evidence_hint: evidenceHint,
          },
    );
  }

  return { schema_format_version: 1, sections };
}

async function main() {
  await dbConnect();

  const workspace = await Workspace.findOne({ slug: "default" });
  if (!workspace) {
    throw new Error(
      "Default workspace not found — run `npm run db:seed` first.",
    );
  }
  const admin = await User.findOne({ email: env.SUPER_ADMIN_EMAIL });
  if (!admin) {
    throw new Error(
      "Super-admin user not found — run `npm run db:seed` first.",
    );
  }

  const ctx = { workspaceId: workspace._id };
  const templateRepo = new TemplateRepository(ctx);
  const existing = await templateRepo.findLatestVersion(TEMPLATE_KEY);
  if (existing) {
    console.log(
      `Template "${TEMPLATE_KEY}" already exists (version ${existing.version}, ${existing.status}) — skipping. ` +
        `To pull in an updated questionnaire, use the app's "create new version" flow, not a re-run of this script.`,
    );
    await mongoose.disconnect();
    return;
  }

  const csvText = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(csvText);
  const questionsSchema = buildSchemaFromCsv(rows);
  validateQuestionsSchemaStructure(questionsSchema);

  const totalQuestions = questionsSchema.sections.reduce(
    (sum, s) => sum + s.questions.length,
    0,
  );
  console.log(
    `Parsed ${questionsSchema.sections.length} sections, ${totalQuestions} questions from ${CSV_PATH}.`,
  );

  const template = await createTemplate(
    ctx,
    { userId: admin._id.toString() },
    {
      template_key: TEMPLATE_KEY,
      name: TEMPLATE_NAME,
      description:
        "Client-provided vendor risk assessment questionnaire (WFPL v2.0), imported verbatim from docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv. Every question is single_select Yes/No.",
      questions_schema: questionsSchema,
    },
  );
  await publishTemplate(
    ctx,
    { userId: admin._id.toString() },
    template._id.toString(),
  );

  console.log(
    `Template "${TEMPLATE_NAME}" (${TEMPLATE_KEY}) created and published in workspace "${workspace.slug}".`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
