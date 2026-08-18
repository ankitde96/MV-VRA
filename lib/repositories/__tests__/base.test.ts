import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { TenantScopeError } from "@/lib/errors";
import { VendorRepository } from "@/lib/repositories/vendor-repository";

describe("TenantRepository construction", () => {
  it("throws TenantScopeError when constructed with no context at all", () => {
    // @ts-expect-error - intentionally omitting the required context to prove the guard
    expect(() => new VendorRepository(undefined)).toThrow(TenantScopeError);
  });

  it("throws TenantScopeError when workspaceId is missing", () => {
    // @ts-expect-error - intentionally missing workspaceId
    expect(() => new VendorRepository({})).toThrow(TenantScopeError);
  });

  it("throws TenantScopeError when workspaceId is an empty string", () => {
    expect(() => new VendorRepository({ workspaceId: "" })).toThrow(
      TenantScopeError,
    );
  });

  it("constructs successfully with a valid workspaceId", () => {
    const repo = new VendorRepository({ workspaceId: new Types.ObjectId() });
    expect(repo).toBeInstanceOf(VendorRepository);
  });
});
