/**
 * CONSTRAINTS.md #10 — one interface, resolved to local-fs (dev) or S3 (prod) by
 * STORAGE_DRIVER (lib/env.ts). Feature code depends only on this; it never imports a
 * driver or the S3 SDK directly. Content-type is deliberately not part of this contract —
 * callers already track `mime` alongside the key (e.g. `Vendor.documents`), so the driver
 * only needs to move bytes.
 */
export interface StorageDriver {
  put(key: string, body: Buffer): Promise<{ size: number }>;
  get(key: string): Promise<Buffer>;
  /**
   * Phase 7's `scripts/sweep-orphaned-evidence.ts` — lists every key under `prefix` so a
   * reconciliation pass can diff storage against what `Response.evidence` actually
   * references, without any caller needing to know local-fs vs. S3 well enough to list
   * one directly (`CONSTRAINTS.md` #10).
   */
  list(prefix: string): Promise<string[]>;
  /**
   * The sweep script's explicit `--delete` pass, and (since ASSESSMENT-WORKFLOW-PLAN.md
   * Stage 1) `deleteEvidence()` removing a vendor's own mistaken upload.
   */
  delete(key: string): Promise<void>;
}
