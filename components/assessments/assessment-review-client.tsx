"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RaiseRiskDialog } from "@/components/risks/raise-risk-dialog";
import {
  SeverityBadge,
  type Severity,
} from "@/components/domain/severity-badge";
import { StatusBadge } from "@/components/domain/status-badge";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";

interface AssessmentReviewClientProps {
  initialData: {
    assessment: {
      id: string;
      status: string;
      template_version: number;
      overall_score: number | null | undefined;
      assigned_at: string | null;
      submitted_at: string | null;
      reviewed_at: string | null;
    };
    vendor: {
      id: string;
      legal_name: string;
      domain: string;
    };
    engagement: {
      id: string;
      business_unit: string;
      inherent_risk_score: number | null;
      inherent_risk_tier: number | null | undefined;
    };
    questions: ReviewerQuestionItem[];
    risks: Array<{
      id: string;
      control_id: string;
      title: string;
      description: string;
      severity: string;
      enterprise_risk_category: string;
      impact_level: string;
      residual_score: number;
      status: string;
    }>;
    enterprise_risk_categories: string[];
    is_provisional_taxonomy: boolean;
    metrics: {
      total: number;
      answered: number;
      passed: number;
      exception: number;
      failed: number;
      missing: number;
      suppressed: number;
      risks_count: number;
    };
  };
}

const CONTROL_STATUS_BADGES: Record<
  ReviewerQuestionItem["control_status"],
  { label: string; className: string }
> = {
  passed: {
    label: "Passed",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  exception: {
    label: "Exception",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  missing: {
    label: "Missing",
    className:
      "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
  suppressed: {
    label: "Suppressed",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function AssessmentReviewClient({
  initialData,
}: AssessmentReviewClientProps) {
  const router = useRouter();
  const {
    assessment,
    vendor,
    engagement,
    questions,
    risks,
    enterprise_risk_categories,
    is_provisional_taxonomy,
    metrics,
  } = initialData;

  const [dialogControlId, setDialogControlId] = useState<string | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompleted = assessment.status === "completed";

  // Group questions by section
  const sectionsMap = new Map<string, ReviewerQuestionItem[]>();
  for (const q of questions) {
    sectionsMap.set(q.section_title, [
      ...(sectionsMap.get(q.section_title) ?? []),
      q,
    ]);
  }

  async function handleCompleteReview() {
    setError(null);
    setCompleting(true);
    try {
      const res = await fetch(
        `/api/assessments/${assessment.id}/complete-review`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Failed to complete review.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  function openRaiseRiskModal(
    controlId: string,
    text: string,
    guidanceText?: string,
  ) {
    setDialogControlId(controlId);
    setDialogTitle(`Risk Exception: ${controlId} - ${text.slice(0, 50)}`);
    setDialogDescription(
      guidanceText ?? `Control failure detected for ${controlId}`,
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-xl font-bold">
              {vendor.legal_name}
            </h1>
            <StatusBadge status={assessment.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Engagement:{" "}
            <span className="text-foreground font-medium">
              {engagement.business_unit}
            </span>{" "}
            | Template Version: v{assessment.template_version}
            {engagement.inherent_risk_score !== null
              ? ` | Inherent Score: ${engagement.inherent_risk_score}`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-card rounded-lg border p-3 text-right shadow-(--shadow-card)">
            <span className="text-muted-foreground block text-xs font-medium tracking-wider uppercase">
              Overall Assessment Score
            </span>
            <span className="text-primary font-mono text-2xl font-bold">
              {assessment.overall_score !== null ? assessment.overall_score : 0}
            </span>
            <span className="text-muted-foreground block font-mono text-[10px]">
              Sum of Constituent Risks
            </span>
          </div>

          {!isCompleted ? (
            <Button onClick={handleCompleteReview} disabled={completing}>
              {completing ? "Completing…" : "Complete Review"}
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Review Completed
            </Button>
          )}
        </div>
      </div>

      {/* Provisional Taxonomy Alert if applicable */}
      {is_provisional_taxonomy ? (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <span>
            <strong className="font-semibold">
              Provisional Risk Taxonomy:
            </strong>{" "}
            Enterprise risk categories are using seeded defaults. Workspace
            taxonomy can be configured in settings.
          </span>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-300"
          >
            Provisional
          </Badge>
        </div>
      ) : null}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Total Controls
          </span>
          <span className="text-lg font-bold">{metrics.total}</span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Passed
          </span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.passed}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Exceptions
          </span>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {metrics.exception}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Failed
          </span>
          <span className="text-destructive text-lg font-bold">
            {metrics.failed}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Missing
          </span>
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {metrics.missing}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Suppressed
          </span>
          <span className="text-muted-foreground text-lg font-bold">
            {metrics.suppressed}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Risks Raised
          </span>
          <span className="text-primary font-mono text-lg font-bold">
            {metrics.risks_count}
          </span>
        </div>
      </div>

      {/* Raised Risks Section if any exist */}
      {risks.length > 0 ? (
        <section className="bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold">
              Identified Risks Raised ({risks.length})
            </h2>
            <Link
              href="/risks"
              className="text-primary text-xs hover:underline"
            >
              View in Risk Register →
            </Link>
          </div>
          <div className="divide-y rounded-md border">
            {risks.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono font-bold">
                      {r.control_id}
                    </span>
                    <span className="text-foreground font-medium">
                      {r.title}
                    </span>
                    <SeverityBadge severity={r.severity as Severity} />
                  </div>
                  <p className="text-muted-foreground">
                    Category: {r.enterprise_risk_category} | Impact:{" "}
                    {r.impact_level}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-muted-foreground block text-xs">
                    Residual Score
                  </span>
                  <span className="text-primary text-sm font-bold">
                    {r.residual_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Question Responses Evaluation by Section */}
      <section className="space-y-6">
        <h2 className="text-foreground text-base font-semibold">
          Questionnaire Evaluation
        </h2>

        {[...sectionsMap.entries()].map(([sectionTitle, sectionQuestions]) => (
          <div
            key={sectionTitle}
            className="bg-card space-y-3 rounded-lg border p-4"
          >
            <h3 className="text-foreground border-b pb-2 text-sm font-semibold">
              {sectionTitle}
            </h3>

            <div className="space-y-4 pt-1">
              {sectionQuestions.map((q) => {
                const statusBadge = CONTROL_STATUS_BADGES[q.control_status];

                return (
                  <div
                    key={q.control_id}
                    className={`space-y-3 rounded-md border p-4 text-xs transition-colors ${
                      q.is_suppressed
                        ? "bg-muted/40 opacity-75"
                        : "bg-background"
                    }`}
                  >
                    {/* Control Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-mono text-xs font-bold">
                            {q.control_id}
                          </span>
                          <Badge
                            variant="outline"
                            className={statusBadge.className}
                          >
                            {statusBadge.label}
                          </Badge>
                          {q.is_required ? (
                            <span className="text-muted-foreground text-[10px]">
                              (Required)
                            </span>
                          ) : null}
                        </div>
                        <p className="text-foreground text-sm font-medium">
                          {q.text}
                        </p>
                      </div>

                      {!q.is_suppressed && !isCompleted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openRaiseRiskModal(
                              q.control_id,
                              q.text,
                              q.suggested_guidance?.suggested_remediation,
                            )
                          }
                        >
                          Raise Risk
                        </Button>
                      ) : null}
                    </div>

                    {/* Vendor Answer */}
                    <div className="bg-muted/20 space-y-1 rounded border p-2">
                      <span className="text-muted-foreground text-[11px] font-semibold">
                        Vendor Answer:
                      </span>
                      <div className="text-foreground font-mono text-xs">
                        {q.response_value !== null &&
                        q.response_value !== undefined ? (
                          Array.isArray(q.response_value) ? (
                            q.response_value.join(", ")
                          ) : (
                            String(q.response_value)
                          )
                        ) : (
                          <span className="text-muted-foreground italic">
                            No answer provided
                          </span>
                        )}
                      </div>

                      {/* Evidence Files */}
                      {q.evidence.length > 0 ? (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          <span className="text-muted-foreground block text-[11px] font-semibold">
                            Attached Evidence ({q.evidence.length}):
                          </span>
                          <ul className="space-y-1">
                            {q.evidence.map((ev) => (
                              <li
                                key={ev.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span>
                                  {ev.filename} ({(ev.size / 1024).toFixed(1)}{" "}
                                  KB)
                                </span>
                                <a
                                  href={ev.download_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary font-medium hover:underline"
                                >
                                  Download ↗
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {/* Suggested Mitigation Guidance */}
                    {q.suggested_guidance ? (
                      <div className="space-y-1 rounded border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-900 dark:text-blue-200">
                        <span className="block font-semibold">
                          Suggested Mitigation Guidance:
                        </span>
                        <p>{q.suggested_guidance.suggested_remediation}</p>
                      </div>
                    ) : null}

                    {/* Associated Raised Risks */}
                    {q.associated_risks.length > 0 ? (
                      <div className="border-primary/30 bg-primary/5 space-y-1 rounded border p-2.5">
                        <span className="text-primary block text-xs font-semibold">
                          Associated Identified Risks (
                          {q.associated_risks.length}):
                        </span>
                        {q.associated_risks.map((ar) => (
                          <div
                            key={ar.id}
                            className="flex items-center justify-between font-mono text-xs"
                          >
                            <span>{ar.title}</span>
                            <span className="text-primary font-bold">
                              Score: {ar.residual_score}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Raise Risk Dialog Modal */}
      {dialogControlId ? (
        <RaiseRiskDialog
          assessmentId={assessment.id}
          controlId={dialogControlId}
          defaultTitle={dialogTitle}
          defaultDescription={dialogDescription}
          categories={enterprise_risk_categories}
          inherentScore={engagement.inherent_risk_score}
          open={Boolean(dialogControlId)}
          onOpenChange={(open) => {
            if (!open) setDialogControlId(null);
          }}
        />
      ) : null}
    </div>
  );
}
