import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function InternalNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>Not found</EmptyTitle>
          <EmptyDescription>
            This record doesn&apos;t exist, or you don&apos;t have access to it
            in your current workspace.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
