import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/current-session";
import { listTemplates } from "@/lib/services/questionnaire-templates";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import {
  TemplatesTable,
  type TemplateRow,
} from "@/components/templates/templates-table";

/**
 * One row per `template_key`, showing its highest version — `listTemplates` returns every
 * version sorted `template_key asc, version desc`, so the first row seen per key is always
 * the latest (draft, if one exists, since a draft is always the newest version by
 * construction — lib/services/questionnaire-templates.ts).
 */
export default async function TemplatesPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const templates = await listTemplates({ workspaceId: session.workspaceId });

  const latestByKey = new Map<string, (typeof templates)[number]>();
  for (const template of templates) {
    if (!latestByKey.has(template.template_key)) {
      latestByKey.set(template.template_key, template);
    }
  }

  const rows: TemplateRow[] = [...latestByKey.values()].map((template) => {
    const schema = template.questions_schema as unknown as {
      sections?: Array<{ questions?: unknown[] }>;
    };
    const sections = schema.sections ?? [];
    return {
      id: template._id.toString(),
      name: template.name,
      template_key: template.template_key,
      version: template.version,
      status: template.status,
      sections: sections.length,
      questions: sections.reduce(
        (sum, section) => sum + (section.questions?.length ?? 0),
        0,
      ),
    };
  });

  return (
    <div>
      <PageHeader
        title="Questionnaire templates"
        description="Versioned assessment templates for this workspace."
        actions={
          <Button render={<Link href="/templates/new" />}>New template</Button>
        }
      />
      <TemplatesTable rows={rows} />
    </div>
  );
}
