"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DATA_CLASSIFICATION_OPTIONS = [
  { value: "pii", label: "PII" },
  { value: "phi", label: "PHI" },
  { value: "financial", label: "Financial" },
  { value: "none", label: "None" },
] as const;

const NETWORK_EXPOSURE_OPTIONS = [
  { value: "external", label: "External (internet-facing)" },
  { value: "internal", label: "Internal only" },
  { value: "none", label: "None" },
] as const;

const SYSTEM_ACCESS_LEVEL_OPTIONS = [
  { value: "admin", label: "Administrative access" },
  { value: "write", label: "Write access" },
  { value: "read", label: "Read-only access" },
  { value: "none", label: "No access" },
] as const;

const BUSINESS_REDUNDANCY_OPTIONS = [
  { value: "single_source", label: "Single source — no alternative vendor" },
  { value: "some_redundancy", label: "Some redundancy available" },
  { value: "fully_redundant", label: "Fully redundant" },
] as const;

interface FormState {
  legal_name: string;
  domain: string;
  spoc_name: string;
  spoc_email: string;
  spoc_phone: string;
  business_unit: string;
  functional_scope: string;
  expected_procurement_date: string;
  data_classification: string[];
  network_exposure: string;
  system_access_level: string;
  business_redundancy: string;
}

const initialState: FormState = {
  legal_name: "",
  domain: "",
  spoc_name: "",
  spoc_email: "",
  spoc_phone: "",
  business_unit: "",
  functional_scope: "",
  expected_procurement_date: "",
  data_classification: [],
  network_exposure: "",
  system_access_level: "",
  business_redundancy: "",
};

export function VendorIntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleDataClassification(value: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      data_classification: checked
        ? [...prev.data_classification, value]
        : prev.data_classification.filter((v) => v !== value),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: form.legal_name,
          domain: form.domain,
          spoc: {
            spoc_name: form.spoc_name,
            spoc_email: form.spoc_email,
            spoc_phone: form.spoc_phone,
          },
          business_unit: form.business_unit,
          functional_scope: form.functional_scope,
          expected_procurement_date: form.expected_procurement_date,
          data_classification: form.data_classification,
          network_exposure: form.network_exposure,
          system_access_level: form.system_access_level,
          business_redundancy: form.business_redundancy,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          body?.message ??
            "Submission failed. Please check the form and try again.",
        );
        return;
      }

      toast.success("Vendor intake submitted.");
      router.push("/vendors");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Vendor</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="legal_name">Legal name</Label>
            <Input
              id="legal_name"
              required
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              required
              placeholder="vendor.example.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Vendor SPOC</h2>
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
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">Engagement</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="business_unit">Business unit</Label>
            <Input
              id="business_unit"
              required
              value={form.business_unit}
              onChange={(e) =>
                setForm({ ...form, business_unit: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected_procurement_date">
              Expected procurement date
            </Label>
            <Input
              id="expected_procurement_date"
              type="date"
              required
              value={form.expected_procurement_date}
              onChange={(e) =>
                setForm({ ...form, expected_procurement_date: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="functional_scope">Functional scope</Label>
          <Input
            id="functional_scope"
            required
            placeholder="What will this vendor do?"
            value={form.functional_scope}
            onChange={(e) =>
              setForm({ ...form, functional_scope: e.target.value })
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          Inherent risk factors
        </h2>

        <div className="space-y-2">
          <Label>Data types processed</Label>
          <div className="flex flex-wrap gap-4">
            {DATA_CLASSIFICATION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={form.data_classification.includes(option.value)}
                  onCheckedChange={(checked) =>
                    toggleDataClassification(option.value, checked === true)
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Network exposure</Label>
            <Select
              value={form.network_exposure}
              onValueChange={(value) =>
                setForm({ ...form, network_exposure: value as string })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {NETWORK_EXPOSURE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>System access level</Label>
            <Select
              value={form.system_access_level}
              onValueChange={(value) =>
                setForm({ ...form, system_access_level: value as string })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ACCESS_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Business redundancy</Label>
            <Select
              value={form.business_redundancy}
              onValueChange={(value) =>
                setForm({ ...form, business_redundancy: value as string })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_REDUNDANCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Button type="submit" disabled={loading}>
        {loading ? "Submitting…" : "Submit intake"}
      </Button>
    </form>
  );
}
