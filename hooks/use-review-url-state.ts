"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseReviewUrlState } from "@/components/assessments/review/review-url-state";

export function useReviewUrlState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewUrlState = useMemo(
    () => parseReviewUrlState(searchParams),
    [searchParams],
  );

  const updateReviewUrlState = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) nextParams.delete(key);
        else nextParams.set(key, value);
      }
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  return { ...reviewUrlState, updateReviewUrlState };
}
