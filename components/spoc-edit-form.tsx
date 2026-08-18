"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SpocEditFormProps {
  vendorId: string;
  initialSpoc: { spoc_name: string; spoc_email: string; spoc_phone: string };
}

export function SpocEditForm({ vendorId, initialSpoc }: SpocEditFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialSpoc);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/vendors/${vendorId}/spoc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        toast.error(
          responseBody?.message ?? "Could not save the SPOC. Please try again.",
        );
        return;
      }

      toast.success("SPOC saved.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="spoc_name">Name</Label>
          <Input
            id="spoc_name"
            required
            value={form.spoc_name}
            onChange={(e) => setForm({ ...form, spoc_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spoc_email">Email</Label>
          <Input
            id="spoc_email"
            type="email"
            required
            value={form.spoc_email}
            onChange={(e) => setForm({ ...form, spoc_email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="spoc_phone">Phone</Label>
          <Input
            id="spoc_phone"
            required
            value={form.spoc_phone}
            onChange={(e) => setForm({ ...form, spoc_phone: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save SPOC"}
        </Button>
      </div>
    </form>
  );
}
