import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max requests within the window", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("key", 3, 1000)).toBe(true);
    }
  });

  it("blocks the request once max is reached within the window", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("key", 3, 1000);
    expect(checkRateLimit("key", 3, 1000)).toBe(false);
  });

  it("keys are independent of each other", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("key-a", 3, 1000);
    expect(checkRateLimit("key-a", 3, 1000)).toBe(false);
    expect(checkRateLimit("key-b", 3, 1000)).toBe(true);
  });

  it("allows requests again once the window has elapsed", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("key", 3, 1000);
    expect(checkRateLimit("key", 3, 1000)).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(checkRateLimit("key", 3, 1000)).toBe(true);
  });
});
