import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { DashboardSummary } from "@/lib/services/dashboard";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function describe(action: string, entityType: string) {
  const verb = action.replace(/_/g, " ");
  return `${verb} · ${entityType.replace(/_/g, " ")}`;
}

export function RecentActivity({
  events,
}: {
  events: DashboardSummary["recent_activity"];
}) {
  return (
    <Card className="shadow-(--shadow-card)">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Activity />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>
                Workspace audit events will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="text-foreground capitalize">
                  {describe(event.action, event.entity_type)}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                  {timeAgo(event.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
