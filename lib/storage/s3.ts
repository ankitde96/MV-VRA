import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NotFoundError } from "@/lib/errors";
import type { StorageDriver } from "./types";

/**
 * Prod driver (STORAGE_DRIVER=s3). Unconfigured this phase — no bucket/credentials exist
 * yet, and `lib/storage/index.ts` refuses to construct this without AWS_S3_BUCKET +
 * AWS_REGION set. Exercised only by lib/storage/__tests__/s3.test.ts against a mocked
 * client until Phase 12 wires real config (`ROLLBACK.md`: confirm S3 versioning is enabled
 * before any prod write).
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    this.client = new S3Client({ region });
  }

  async put(key: string, body: Buffer): Promise<{ size: number }> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body }),
    );
    return { size: body.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    let result;
    try {
      result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        throw new NotFoundError(`Storage object not found: ${key}`);
      }
      throw error;
    }
    if (!result.Body) {
      throw new NotFoundError(`Storage object not found: ${key}`);
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of result.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
