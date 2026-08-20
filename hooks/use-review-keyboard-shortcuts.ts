"use client";

import { useEffect } from "react";
import {
  getReviewControlDomId,
  getReviewNoteDomId,
} from "@/components/assessments/review/review-productivity";

interface UseReviewKeyboardShortcutsOptions {
  controlIds: string[];
  focusedControlId: string | null;
  canEdit: boolean;
  searchInputId: string;
  onFocusControl: (controlId: string) => void;
  onMarkCompliant: (controlId: string) => void;
  onMarkNonCompliant: (controlId: string) => void;
  onOpenHelp: () => void;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

export function useReviewKeyboardShortcuts({
  controlIds,
  focusedControlId,
  canEdit,
  searchInputId,
  onFocusControl,
  onMarkCompliant,
  onMarkNonCompliant,
  onOpenHelp,
}: UseReviewKeyboardShortcutsOptions): void {
  useEffect(() => {
    function focusControl(controlId: string) {
      onFocusControl(controlId);
      const row = document.getElementById(getReviewControlDomId(controlId));
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLocaleLowerCase();
      if (key === "?") {
        event.preventDefault();
        onOpenHelp();
        return;
      }
      if (key === "/") {
        event.preventDefault();
        document.getElementById(searchInputId)?.focus();
        return;
      }
      if (controlIds.length === 0) return;

      const currentIndex = focusedControlId
        ? controlIds.indexOf(focusedControlId)
        : -1;
      if (key === "j" || key === "k") {
        event.preventDefault();
        const delta = key === "j" ? 1 : -1;
        const fallback = key === "j" ? 0 : controlIds.length - 1;
        const nextIndex =
          currentIndex === -1
            ? fallback
            : (currentIndex + delta + controlIds.length) % controlIds.length;
        focusControl(controlIds[nextIndex]!);
        return;
      }

      const activeControlId =
        currentIndex === -1 ? controlIds[0]! : controlIds[currentIndex]!;
      if (key === "c" && canEdit) {
        event.preventDefault();
        focusControl(activeControlId);
        onMarkCompliant(activeControlId);
      } else if (key === "x" && canEdit) {
        event.preventDefault();
        focusControl(activeControlId);
        onMarkNonCompliant(activeControlId);
      } else if (key === "n" && canEdit) {
        event.preventDefault();
        focusControl(activeControlId);
        document.getElementById(getReviewNoteDomId(activeControlId))?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canEdit,
    controlIds,
    focusedControlId,
    onFocusControl,
    onMarkCompliant,
    onMarkNonCompliant,
    onOpenHelp,
    searchInputId,
  ]);
}
