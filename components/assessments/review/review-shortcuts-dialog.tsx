"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  ["J / K", "Move to the next / previous visible control"],
  ["C", "Mark the focused control compliant"],
  ["X", "Mark the focused control non-compliant"],
  ["N", "Focus the reviewer note for the current control"],
  ["/", "Focus review search"],
  ["?", "Open this shortcut guide"],
] as const;

export function ReviewShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts pause while an input, note, or select control has focus.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y rounded-lg border">
          {SHORTCUTS.map(([keys, description]) => (
            <div
              key={keys}
              className="flex items-center justify-between gap-4 px-3 py-2.5"
            >
              <dt>
                <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs font-semibold">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-muted-foreground text-right text-xs">
                {description}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
