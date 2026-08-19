export const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not sent",
  sent: "Pending response from vendor",
  in_progress: "Pending response from vendor",
  changes_requested: "Pending response from vendor",
  submitted: "Pending review",
  under_review: "Pending review",
  completed: "Completed",
  archived: "Archived",
};

export function assessmentStatusLabel(status: string): string {
  return ASSESSMENT_STATUS_LABEL[status] ?? status;
}
