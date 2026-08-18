import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { S3StorageDriver } from "@/lib/storage/s3";

/**
 * DECISIONS.md 017: S3 stays unconfigured this phase, but the implementation must compile
 * and be unit-tested against a mock (PLAN.md Phase 4 exit criterion) — no real AWS call is
 * ever made from this suite.
 */
describe("S3StorageDriver", () => {
  it("put() sends a PutObjectCommand for the given bucket/key/body", async () => {
    const send = vi.fn().mockResolvedValue({});
    const driver = new S3StorageDriver("test-bucket", "us-east-1");
    // Replace the internal client with a stub — this is the "mocked client" boundary; no
    // real network call is made.
    (driver as unknown as { client: { send: typeof send } }).client = { send };

    const body = Buffer.from("evidence bytes");
    const result = await driver.put("workspace/vendor/key.pdf", body);

    expect(result.size).toBe(body.byteLength);
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "workspace/vendor/key.pdf",
      Body: body,
    });
  });

  it("get() concatenates the response body stream into a Buffer", async () => {
    async function* chunks() {
      yield new Uint8Array(Buffer.from("hello "));
      yield new Uint8Array(Buffer.from("world"));
    }
    const send = vi.fn().mockResolvedValue({ Body: chunks() });
    const driver = new S3StorageDriver("test-bucket", "us-east-1");
    (driver as unknown as { client: { send: typeof send } }).client = { send };

    const result = await driver.get("workspace/vendor/key.pdf");
    expect(result.toString()).toBe("hello world");
  });

  it("get() surfaces a missing object as NotFoundError, not a raw SDK error", async () => {
    const error = Object.assign(new Error("not found"), { name: "NoSuchKey" });
    const send = vi.fn().mockRejectedValue(error);
    const driver = new S3StorageDriver("test-bucket", "us-east-1");
    (driver as unknown as { client: { send: typeof send } }).client = { send };

    await expect(driver.get("workspace/vendor/missing.pdf")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("list() sends a ListObjectsV2Command scoped to the given prefix", async () => {
    const send = vi.fn().mockResolvedValue({
      Contents: [{ Key: "workspace/a.pdf" }, { Key: "workspace/b.pdf" }],
      IsTruncated: false,
    });
    const driver = new S3StorageDriver("test-bucket", "us-east-1");
    (driver as unknown as { client: { send: typeof send } }).client = { send };

    const keys = await driver.list("workspace");
    expect(keys).toEqual(["workspace/a.pdf", "workspace/b.pdf"]);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: "test-bucket",
      Prefix: "workspace",
    });
  });

  it("list() follows pagination via ContinuationToken", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Contents: [{ Key: "workspace/a.pdf" }],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: "workspace/b.pdf" }],
        IsTruncated: false,
      });
    const driver = new S3StorageDriver("test-bucket", "us-east-1");
    (driver as unknown as { client: { send: typeof send } }).client = { send };

    const keys = await driver.list("workspace");
    expect(keys).toEqual(["workspace/a.pdf", "workspace/b.pdf"]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].input).toMatchObject({
      ContinuationToken: "page-2",
    });
  });

  it("delete() sends a DeleteObjectCommand for the given bucket/key", async () => {
    const send = vi.fn().mockResolvedValue({});
    const driver = new S3StorageDriver("test-bucket", "us-east-1");
    (driver as unknown as { client: { send: typeof send } }).client = { send };

    await driver.delete("workspace/vendor/key.pdf");
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: "test-bucket",
      Key: "workspace/vendor/key.pdf",
    });
  });
});
