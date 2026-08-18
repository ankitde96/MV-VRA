import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  generateOtpCode,
  hashOtpCode,
} from "@/lib/auth/otp";

describe("generateOtpCode", () => {
  it("always produces a 6-digit numeric string, zero-padded", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode", () => {
  it("is deterministic for the same code", async () => {
    const a = await hashOtpCode("123456");
    const b = await hashOtpCode("123456");
    expect(a).toBe(b);
  });

  it("differs for a different code", async () => {
    const a = await hashOtpCode("123456");
    const b = await hashOtpCode("654321");
    expect(a).not.toBe(b);
  });
});

describe("constantTimeEqual", () => {
  it("is true for identical strings", () => {
    expect(constantTimeEqual("abcdef", "abcdef")).toBe(true);
  });

  it("is false for a single differing character", () => {
    expect(constantTimeEqual("abcdef", "abcdeg")).toBe(false);
  });

  it("is false for different-length strings, without throwing", () => {
    expect(constantTimeEqual("abc", "abcdef")).toBe(false);
  });
});
