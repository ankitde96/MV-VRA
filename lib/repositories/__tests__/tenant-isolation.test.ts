// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { VendorRepository } from "@/lib/repositories/vendor-repository";

/**
 * DATA-MODEL.md §1 / TEST-CHECKLIST.md Gate 4: verified against a real database, not by
 * reading the code. Requires a reachable MongoDB — see vitest.setup.ts for the test
 * database default.
 */
describe("tenant isolation (integration)", () => {
  const workspaceA = new Types.ObjectId();
  const workspaceB = new Types.ObjectId();
  let vendorAId: Types.ObjectId;
  let vendorBId: Types.ObjectId;

  beforeAll(async () => {
    await dbConnect();
    const vendorA = await Vendor.create({
      workspace_id: workspaceA,
      legal_name: "Vendor A",
      domain: "vendor-a.isolation-test.example",
      spoc: {
        spoc_name: "A Spoc",
        spoc_email: "a@vendor-a.isolation-test.example",
        spoc_phone: "+10000000000",
      },
    });
    const vendorB = await Vendor.create({
      workspace_id: workspaceB,
      legal_name: "Vendor B",
      domain: "vendor-b.isolation-test.example",
      spoc: {
        spoc_name: "B Spoc",
        spoc_email: "b@vendor-b.isolation-test.example",
        spoc_phone: "+10000000001",
      },
    });
    vendorAId = vendorA._id;
    vendorBId = vendorB._id;
  });

  afterAll(async () => {
    await Vendor.deleteMany({
      workspace_id: { $in: [workspaceA, workspaceB] },
    });
    await mongoose.disconnect();
  });

  it("a repository scoped to workspace A cannot find workspace B's vendor by id", async () => {
    const repoA = new VendorRepository({ workspaceId: workspaceA });
    const found = await repoA.findById(vendorBId);
    expect(found).toBeNull();
  });

  it("a repository scoped to workspace A finds its own vendor by id", async () => {
    const repoA = new VendorRepository({ workspaceId: workspaceA });
    const found = await repoA.findById(vendorAId);
    expect(found).not.toBeNull();
    expect(found?.legal_name).toBe("Vendor A");
  });

  it("count() scoped to workspace A never counts workspace B documents", async () => {
    const repoA = new VendorRepository({ workspaceId: workspaceA });
    await expect(repoA.count({})).resolves.toBe(1);
  });

  it("find() scoped to workspace A never returns workspace B documents", async () => {
    const repoA = new VendorRepository({ workspaceId: workspaceA });
    const results = await repoA.find({});
    expect(results).toHaveLength(1);
    expect(results[0]?.workspace_id.toString()).toBe(workspaceA.toString());
  });

  it("create() always stamps the constructing context workspace_id, ignoring any other value passed in", async () => {
    const repoA = new VendorRepository({ workspaceId: workspaceA });
    const created = await repoA.create({
      // @ts-expect-error - deliberately trying to smuggle workspace B's id through create()
      workspace_id: workspaceB,
      legal_name: "Smuggled Vendor",
      domain: "smuggled.isolation-test.example",
      spoc: {
        spoc_name: "S Spoc",
        spoc_email: "s@smuggled.isolation-test.example",
        spoc_phone: "+10000000002",
      },
    });
    expect(created.workspace_id.toString()).toBe(workspaceA.toString());
    await Vendor.deleteOne({ _id: created._id });
  });
});
