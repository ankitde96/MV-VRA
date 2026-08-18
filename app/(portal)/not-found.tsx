import { SearchX } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            This link may have expired or already been used. Contact the team
            that sent it to you for a new one.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
