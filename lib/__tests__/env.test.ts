import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";

describe("env", () => {
  it("parses the process environment with defaults applied", () => {
    expect(["development", "test", "production"]).toContain(env.NODE_ENV);
    expect(["local-fs", "s3"]).toContain(env.STORAGE_DRIVER);
  });
});
