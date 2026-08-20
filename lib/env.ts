import { z } from "zod";

/**
 * Validated once at process startup (imported by lib/db/connect.ts and the root layout),
 * not per-request. An invalid or missing variable fails the boot, not the first request —
 * nodejs-best-practices "validate at boundaries", applied to environment variables.
 *
 * Phase 0 only needs NODE_ENV and STORAGE_DRIVER (the local-fs/S3 switch, CONSTRAINTS.md
 * #10). MONGODB_URI, OTP secret, mail provider, and AWS credentials are added in the phases
 * that first need them (1, 6, 4/12) rather than speculatively now.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  STORAGE_DRIVER: z.enum(["local-fs", "s3"]).default("local-fs"),
  // Single-node replica set `rs0` (converted from standalone ahead of Phase 3 —
  // DECISIONS.md — so Vendor+Engagement can be written atomically via a multi-document
  // transaction). `replicaSet=rs0` is required in the URI or the driver treats the
  // connection as a direct standalone and transactions fail outright.
  MONGODB_URI: z
    .string()
    .min(1)
    .default("mongodb://127.0.0.1:27017/mv-vra?replicaSet=rs0"),
  // Phase 2: internal auth. SUPER_ADMIN_EMAIL/PASSWORD_HASH identify which seeded User
  // document is allowed to log in for now (ARCHITECTURE.md §1.2 — static credentials until
  // Google SSO lands post-MVP). SESSION_SECRET signs the session cookie and has no default
  // — see the production check below, which fails the boot rather than ever signing a
  // cookie with a guessable value in production.
  SUPER_ADMIN_EMAIL: z.string().email().default("admin@mv-vra.local"),
  SUPER_ADMIN_PASSWORD_HASH: z
    .string()
    .min(1)
    .default("dev-placeholder-not-a-real-argon2-hash"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .optional(),
  // Phase 4: only read when STORAGE_DRIVER=s3 (lib/storage/index.ts refuses to construct
  // the S3 driver without both). Left optional and unconfigured until Phase 12 — S3 stays
  // compiled-and-tested-against-a-mock only until then (DECISIONS.md 017).
  AWS_S3_BUCKET: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
  // Phase 6: signs OTP codes (lib/auth/otp.ts), same no-default/prod-fails-boot pattern as
  // SESSION_SECRET — a guessable OTP secret would let an attacker forge codes.
  OTP_HMAC_SECRET: z
    .string()
    .min(32, "OTP_HMAC_SECRET must be at least 32 characters")
    .optional(),
  // Only 'console' exists (dev transport, lib/mail/console.ts) — PLAN.md's own open
  // question on which real provider to use is explicitly deferred to a later decision, so
  // there is nothing else to enumerate here yet.
  MAIL_PROVIDER: z.enum(["console"]).default("console"),
  // Reviewer Experience Stage 4: metadata is preflighted before an archive reads any
  // storage object. This bounds memory/work and returns a clear validation error instead of
  // beginning a download that cannot safely finish.
  EVIDENCE_ZIP_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(100 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema> & {
  SESSION_SECRET: string;
  OTP_HMAC_SECRET: string;
};

const DEV_SESSION_SECRET =
  "dev-only-insecure-session-secret-do-not-use-in-production";
const DEV_OTP_HMAC_SECRET =
  "dev-only-insecure-otp-hmac-secret-do-not-use-in-production";

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Thrown at import time, not caught — an invalid environment must fail the boot.
    throw new Error(
      `Invalid environment configuration:\n${result.error.toString()}`,
    );
  }

  if (result.data.NODE_ENV === "production") {
    if (!result.data.SESSION_SECRET) {
      throw new Error(
        "SESSION_SECRET is required in production — refusing to boot without it",
      );
    }
    if (!result.data.OTP_HMAC_SECRET) {
      throw new Error(
        "OTP_HMAC_SECRET is required in production — refusing to boot without it",
      );
    }
  }

  return {
    ...result.data,
    SESSION_SECRET: result.data.SESSION_SECRET ?? DEV_SESSION_SECRET,
    OTP_HMAC_SECRET: result.data.OTP_HMAC_SECRET ?? DEV_OTP_HMAC_SECRET,
  };
}

export const env = loadEnv();
