/**
 * In-memory, per-process sliding window — deliberately not a database or Redis-backed
 * limiter (`CONSTRAINTS.md` #1: no new dependency was asked for, and `PLAN.md` A3 already
 * accepts no-HA/single-instance as the MVP target). This resets on every restart and does
 * not share state across instances; both are stated limitations, not oversights, and worth
 * revisiting if Phase 12 ever deploys more than one instance.
 */
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= max) {
    buckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}

/** Test-only: clears all rate-limit state between test cases. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
