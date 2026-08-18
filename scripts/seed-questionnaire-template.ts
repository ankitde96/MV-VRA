/**
 * Seeds the WFPL Vendor Risk Assessment Questionnaire v2.0 as a published
 * `QuestionnaireTemplate`, ready to assign to any engagement — no manual template-builder
 * work needed on a fresh dev environment. Source of truth is the checked-in CSV
 * (`docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv`, the client-provided
 * questionnaire, copied verbatim); this script is the only thing that ever reads it.
 *
 * Every question is deliberately `single_select` Yes/No, per explicit direction — even the
 * handful of genuinely open-ended questions in the source (e.g. "Provide the vendor's name,
 * registered address, and contact details") are Yes/No here, not free text. That's a real
 * semantic loss for those specific questions (a Yes/No answer to "what is your org
 * structure?" isn't meaningful) — flagged here rather than silently "fixed", since the
 * instruction was explicit and changing question types is a content decision, not a
 * technical one.
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
    const text = evidenceText
      ? `${questionText}\n\nEvidence: ${evidenceText}`
      : questionText;

    currentSection.questions.push({
      control_id: controlId,
      text,
      type: "single_select",
      options: ["Yes", "No"],
      required: true,
    });
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
