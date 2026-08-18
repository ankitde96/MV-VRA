import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { requireCapability, roleHasCapability } from "@/lib/auth/rbac";

/**
 * Pure unit tests — the matrix itself is a plain object, no database needed. What matters is
 * that `viewer` never gains a write capability and that `requireCapability()` throws rather
 * than returning false, since every call site (`lib/auth/require-capability.ts`) relies on
 * the throw to short-circuit before the service call underneath it ever runs.
 */
describe("rbac", () => {
  it("grants admin every capability", () => {
    const capabilities = [
      "vendor.write",
      "template.manage",
      "assessment.assign",
      "assessment.review",
      "offboarding.manage",
      "workspace.manage_users",
      "sharing.manage",
      "rollup.view",
    ] as const;
    for (const capability of capabilities) {
      expect(roleHasCapability("admin", capability)).toBe(true);
    }
  });

  it("viewer has zero write capabilities", () => {
    const capabilities = [
      "vendor.write",
      "template.manage",
      "assessment.assign",
      "assessment.review",
      "offboarding.manage",
      "workspace.manage_users",
      "sharing.manage",
      "rollup.view",
    ] as const;
    for (const capability of capabilities) {
      expect(roleHasCapability("viewer", capability)).toBe(false);
    }
  });

  it("business_owner can write vendors and assign assessments, but not review or manage users", () => {
    expect(roleHasCapability("business_owner", "vendor.write")).toBe(true);
    expect(roleHasCapability("business_owner", "assessment.assign")).toBe(true);
    expect(roleHasCapability("business_owner", "assessment.review")).toBe(
      false,
    );
    expect(roleHasCapability("business_owner", "workspace.manage_users")).toBe(
      false,
    );
    expect(roleHasCapability("business_owner", "sharing.manage")).toBe(false);
  });

  it("risk_analyst can review assessments and manage offboarding, but not manage users or sharing", () => {
    expect(roleHasCapability("risk_analyst", "assessment.review")).toBe(true);
    expect(roleHasCapability("risk_analyst", "offboarding.manage")).toBe(true);
    expect(roleHasCapability("risk_analyst", "rollup.view")).toBe(true);
    expect(roleHasCapability("risk_analyst", "workspace.manage_users")).toBe(
      false,
    );
    expect(roleHasCapability("risk_analyst", "sharing.manage")).toBe(false);
  });

  it("requireCapability throws ForbiddenError when the role lacks the capability", () => {
    expect(() => requireCapability("viewer", "vendor.write")).toThrow(
      ForbiddenError,
    );
  });

  it("requireCapability does not throw when the role has the capability", () => {
    expect(() => requireCapability("admin", "vendor.write")).not.toThrow();
  });
});
