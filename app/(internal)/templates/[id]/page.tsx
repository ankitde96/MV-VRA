import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";
import { getTemplate } from "@/lib/services/questionnaire-templates";
import { TemplateBuilderForm } from "@/components/templates/template-builder-form";
import { TemplateActions } from "@/components/templates/template-actions";
import { QuestionnairePreview } from "@/components/questionnaire/questionnaire-preview";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) return null;

  const { id } = await params;

  let template;
  try {
    template = await getTemplate({ workspaceId: session.workspaceId }, id);
  } catch {
    notFound();
  }

  const schema = template.questions_schema as unknown as QuestionsSchema;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-lg font-semibold">
          {template.name}{" "}
          <span className="text-muted-foreground font-normal">
            v{template.version}
          </span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {template.template_key} — {template.status}
        </p>
      </div>

      <TemplateActions templateId={id} status={template.status} />

      {template.status === "draft" ? (
        <TemplateBuilderForm
          templateId={id}
          initialTemplateKey={template.template_key}
          initialName={template.name}
          initialDescription={template.description ?? ""}
          initialSchema={schema}
        />
      ) : (
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground mb-4 text-sm">
            This version is {template.status} and can never be edited —
            publishing freezes a version. Use &ldquo;Create new version to
            edit&rdquo; above to make changes.
          </p>
          <QuestionnairePreview schema={schema} />
        </div>
      )}
    </div>
  );
}
