// @vitest-environment node
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { ValidationError, NotFoundError } from "@/lib/errors";
import {
  getVendorDocument,
  uploadVendorDocument,
} from "@/lib/services/vendor-documents";

/**
 * PLAN.md Phase 4 exit criteria: upload/retrieve a file via local-fs, and unauthorised
 * retrieval of a known key/id is refused. STORAGE_DRIVER defaults to local-fs (lib/env.ts),
 * so this suite exercises the real driver, not a mock — the mock is reserved for S3
 * (lib/storage/__tests__/s3.test.ts), which has nothing to run against yet.
 */
describe("vendor documents (integration)", () => {
  const workspaceA = new Types.ObjectId();
  const workspaceB = new Types.ObjectId();
  const actorId = new Types.ObjectId();

  async function createVendor(workspaceId: Types.ObjectId, domain: string) {
    return Vendor.create({
      workspace_id: workspaceId,
      legal_name: `Vendor ${domain}`,
      domain,
      spoc: {
        spoc_name: "Spoc",
        spoc_email: `spoc@${domain}`,
        spoc_phone: "+10000000000",
      },
    });
  }

  afterEach(async () => {
    await Vendor.deleteMany({
      workspace_id: { $in: [workspaceA, workspaceB] },
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await Promise.all(
      [workspaceA, workspaceB].map((workspaceId) =>
        rm(resolve(process.cwd(), ".storage-local", workspaceId.toString()), {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it("rejects a disallowed MIME type before touching storage or the database", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceA, "reject-mime.example");

    await expect(
      uploadVendorDocument(
        { workspaceId: workspaceA },
        { userId: actorId.toString() },
        vendor._id.toString(),
        {
          filename: "malware.exe",
          mime: "application/x-msdownload",
          body: Buffer.from("x"),
        },
      ),
    ).rejects.toThrow(ValidationError);

    const stored = await Vendor.findById(vendor._id);
    expect(stored?.documents).toHaveLength(0);
  });

  it("rejects a file over the size cap", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceA, "reject-size.example");
    const oversized = Buffer.alloc(11 * 1024 * 1024);

    await expect(
      uploadVendorDocument(
        { workspaceId: workspaceA },
        { userId: actorId.toString() },
        vendor._id.toString(),
        { filename: "big.pdf", mime: "application/pdf", body: oversized },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("uploads and retrieves a file end to end via local-fs", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceA, "roundtrip.example");
    const body = Buffer.from("a real compliance document");

    const document = await uploadVendorDocument(
      { workspaceId: workspaceA },
      { userId: actorId.toString() },
      vendor._id.toString(),
      { filename: "soc2.pdf", mime: "application/pdf", body },
    );

    const stored = await Vendor.findById(vendor._id);
    expect(stored?.documents).toHaveLength(1);
    expect(stored?.documents[0].filename).toBe("soc2.pdf");

    const { document: retrievedMeta, body: retrievedBody } =
      await getVendorDocument(
        { workspaceId: workspaceA },
        vendor._id.toString(),
        document._id.toString(),
      );
    expect(retrievedMeta.filename).toBe("soc2.pdf");
    expect(retrievedBody.equals(body)).toBe(true);
  });

  it("refuses retrieval when the requesting session is scoped to a different workspace", async () => {
    await dbConnect();
    const vendor = await createVendor(workspaceA, "cross-workspace.example");
    const document = await uploadVendorDocument(
      { workspaceId: workspaceA },
      { userId: actorId.toString() },
      vendor._id.toString(),
      {
        filename: "confidential.pdf",
        mime: "application/pdf",
        body: Buffer.from("secret"),
      },
    );

    await expect(
      getVendorDocument(
        { workspaceId: workspaceB },
        vendor._id.toString(),
        document._id.toString(),
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses retrieval of a real document id when it belongs to a different vendor", async () => {
    await dbConnect();
    const vendorOne = await createVendor(workspaceA, "vendor-one.example");
    const vendorTwo = await createVendor(workspaceA, "vendor-two.example");
    const document = await uploadVendorDocument(
      { workspaceId: workspaceA },
      { userId: actorId.toString() },
      vendorOne._id.toString(),
      {
        filename: "vendor-one-only.pdf",
        mime: "application/pdf",
        body: Buffer.from("secret"),
      },
    );

    await expect(
      getVendorDocument(
        { workspaceId: workspaceA },
        vendorTwo._id.toString(),
        document._id.toString(),
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
