import { TemplateBuilderForm } from "@/components/templates/template-builder-form";

export default function NewTemplatePage() {
  return (
    <div>
      <h1 className="text-foreground text-lg font-semibold">
        New questionnaire template
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Creates version 1 as a draft. Publish it once it&apos;s ready — a
        published version can never be edited again, only versioned forward.
      </p>
      <div className="mt-6">
        <TemplateBuilderForm />
      </div>
    </div>
  );
}
