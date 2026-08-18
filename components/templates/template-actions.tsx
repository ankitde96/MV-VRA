"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function postAction(url: string) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Action failed. Please try again.");
  }
}

export function TemplateActions({
  templateId,
  status,
}: {
  templateId: string;
  status: "draft" | "published" | "archived";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {status === "draft" ? (
          <Button
            disabled={loading}
            onClick={() =>
              run(() => postAction(`/api/templates/${templateId}/publish`))
            }
          >
            Publish
          </Button>
        ) : null}
        {status === "published" ? (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              run(async () => {
                const response = await fetch(
                  `/api/templates/${templateId}/new-version`,
                  {
                    method: "POST",
                  },
                );
                if (!response.ok) {
                  const body = await response.json().catch(() => null);
                  throw new Error(
                    body?.message ?? "Could not create a new version.",
                  );
                }
                const { template } = await response.json();
                router.push(`/templates/${template.id}`);
              })
            }
          >
            Create new version to edit
          </Button>
        ) : null}
        {status !== "archived" ? (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              run(() => postAction(`/api/templates/${templateId}/archive`))
            }
          >
            Archive
          </Button>
        ) : null}
      </div>
    </div>
  );
}
