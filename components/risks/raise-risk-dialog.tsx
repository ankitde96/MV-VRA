"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateResidualScore,
  type RiskSeverity,
  type RiskImpactLevel,
} from "@/lib/scoring/residual-risk";

interface RaiseRiskDialogProps {
  assessmentId: string;
  controlId: string;
  defaultTitle?: string;
  defaultDescription?: string;
  categories: string[];
  inherentScore?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RaiseRiskDialog({
  assessmentId,
  controlId,
  defaultTitle = "",
  defaultDescription = "",
  categories,
  inherentScore = null,
  open,
  onOpenChange,
  onSuccess,
}: RaiseRiskDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState(
    defaultTitle || `Risk exception for ${controlId}`,
  );
  const [description, setDescription] = useState(defaultDescription);
  const [severity, setSeverity] = useState<RiskSeverity>("high");
  const [category, setCategory] = useState<string>(
    categories[0] ?? "Information Security",
  );
  const [impactLevel, setImpactLevel] = useState<RiskImpactLevel>("high");
  const [compensatingControlsInput, setCompensatingControlsInput] =
    useState("");
  const [loading, setLoading] = useState(false);

  const compensatingControls = compensatingControlsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const liveScoring = calculateResidualScore({
    severity,
    impact_level: impactLevel,
    inherent_score: inherentScore,
    compensating_controls: compensatingControls,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a risk title.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          control_id: controlId,
          title: title.trim(),
          description: description.trim(),
          severity,
          enterprise_risk_category: category,
          impact_level: impactLevel,
          compensating_controls: compensatingControls,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Failed to raise risk.");
        return;
      }

      toast.success("Risk raised.");
      onOpenChange(false);
      if (onSuccess) onSuccess();
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise Identified Risk — {controlId}</DialogTitle>
          <DialogDescription>
            Document a security risk exception or control failure for review and
            register mapping.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="control_id">Control ID</Label>
            <Input
              id="control_id"
              value={controlId}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Risk Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Missing Multi-Factor Authentication"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="severity">Severity *</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as RiskSeverity)}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical (40)</SelectItem>
                  <SelectItem value="high">High (30)</SelectItem>
                  <SelectItem value="medium">Medium (20)</SelectItem>
                  <SelectItem value="low">Low (10)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="impact_level">Impact Level *</Label>
              <Select
                value={impactLevel}
                onValueChange={(v) => setImpactLevel(v as RiskImpactLevel)}
              >
                <SelectTrigger id="impact_level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical (1.25x)</SelectItem>
                  <SelectItem value="high">High (1.0x)</SelectItem>
                  <SelectItem value="medium">Medium (0.75x)</SelectItem>
                  <SelectItem value="low">Low (0.5x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="category">Enterprise Risk Category *</Label>
            <Select
              value={category}
              onValueChange={(val: string | null) => setCategory(val ?? "")}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Risk Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context regarding the control failure or exception..."
              rows={2}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="compensating">
              Compensating Controls (Comma-separated)
            </Label>
            <Input
              id="compensating"
              value={compensatingControlsInput}
              onChange={(e) => setCompensatingControlsInput(e.target.value)}
              placeholder="e.g. IP Whitelisting, SOC Monitoring (15% reduction each)"
            />
          </div>

          <div className="bg-muted/30 flex items-center justify-between rounded-md border p-3 text-xs">
            <div>
              <span className="text-foreground font-semibold">
                Calculated Residual Score:
              </span>
              <p className="text-muted-foreground mt-0.5">
                Base: {liveScoring.residual_inputs.severity_base_score} ×{" "}
                {liveScoring.residual_inputs.impact_multiplier}x
                {liveScoring.residual_inputs.discount_factor > 0
                  ? ` (Discount: -${liveScoring.residual_inputs.discount_factor * 100}%)`
                  : ""}
              </p>
            </div>
            <span className="text-primary font-mono text-lg font-bold">
              {liveScoring.residual_score}
            </span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Raising Risk…" : "Raise Identified Risk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
