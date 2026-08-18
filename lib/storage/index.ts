import { env } from "@/lib/env";
import { LocalFsStorageDriver } from "./local-fs";
import { S3StorageDriver } from "./s3";
import type { StorageDriver } from "./types";

let driver: StorageDriver | null = null;

/**
 * Selected once per process by STORAGE_DRIVER (lib/env.ts), memoized like
 * lib/db/connect.ts's connection singleton. CONSTRAINTS.md #10 — this is the only export
 * feature code should call; the concrete drivers are not meant to be imported elsewhere.
 */
export function getStorageDriver(): StorageDriver {
  if (driver) return driver;

  if (env.STORAGE_DRIVER === "s3") {
    if (!env.AWS_S3_BUCKET || !env.AWS_REGION) {
      throw new Error(
        "STORAGE_DRIVER=s3 requires AWS_S3_BUCKET and AWS_REGION — not configured yet (PLAN.md Phase 12)",
      );
    }
    driver = new S3StorageDriver(env.AWS_S3_BUCKET, env.AWS_REGION);
  } else {
    driver = new LocalFsStorageDriver();
  }
  return driver;
}

/** Test-only: forces the next getStorageDriver() call to reconstruct the driver. */
export function resetStorageDriverForTests(): void {
  driver = null;
}

export type { StorageDriver } from "./types";
