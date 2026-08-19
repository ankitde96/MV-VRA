// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";
import { OtpChallenge } from "@/lib/db/models/otp-challenge";
import { UnauthorizedError, RateLimitedError } from "@/lib/errors";
import { resetRateLimitsForTests } from "@/lib/auth/rate-limit";
import { issueOtpChallenge } from "@/lib/auth/otp-challenge";
import { requestOtp, verifyOtp } from "@/lib/services/portal-auth";

/**
 * TEST-CHECKLIST.md Gate 4 — this is the whole point of Phase 6: verified against a real
 * database, not by reading the code. Enumeration, expiry, attempt limit, and replay are
 * each their own test, matching PLAN.md Phase 6's exit criterion line for line.
 */
describe("portal OTP auth (integration)", () => {
  const workspaceId = new Types.ObjectId();

  /**
   * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — every vendor now needs at least one active
   * `spocs[]` entry for OTP login to resolve against at all; `extraSpocs` lets a test add
   * more (a second active one, or an inactive one) without repeating this boilerplate.
   */
  async function createVendor(
    domain: string,
    spocEmail: string,
    extraSpocs: Array<{
      email: string;
      status?: "active" | "inactive";
      isPrimary?: boolean;
    }> = [],
  ) {
    return Vendor.create({
      workspace_id: workspaceId,
      legal_name: `Vendor ${domain}`,
      domain,
      spoc: {
        spoc_name: "Spoc",
        spoc_email: spocEmail,
        spoc_phone: "+10000000000",
      },
      spocs: [
        {
          name: "Spoc",
          email: spocEmail,
          phone: "+10000000000",
          is_primary: true,
          status: "active",
        },
        ...extraSpocs.map((extra) => ({
          name: "Spoc",
          phone: "+10000000000",
          is_primary: extra.isPrimary ?? false,
          status: extra.status ?? "active",
          email: extra.email,
        })),
      ],
    });
  }

  beforeEach(() => {
    resetRateLimitsForTests();
  });

  afterEach(async () => {
    await Vendor.deleteMany({ workspace_id: workspaceId });
    await OtpChallenge.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("creates a real challenge when the email matches a vendor SPOC", async () => {
    await dbConnect();
    const vendor = await createVendor("real.example", "spoc@real.example");

    await requestOtp({ email: "spoc@real.example", requestIp: "127.0.0.1" });

    const challenge = await OtpChallenge.findOne({
      email: "spoc@real.example",
    });
    expect(challenge).not.toBeNull();
    expect(challenge?.vendor_id.toString()).toBe(vendor._id.toString());
    expect(challenge?.spoc_id?.toString()).toBe(
      vendor.spocs[0]._id!.toString(),
    );
  });

  it("resolves an OTP request for a SECOND active SPOC on the same vendor, scoped to that SPOC's own id (ASSESSMENT-WORKFLOW-PLAN.md Stage 2)", async () => {
    await dbConnect();
    const vendor = await createVendor(
      "multi-spoc.example",
      "primary@multi-spoc.example",
      [{ email: "secondary@multi-spoc.example" }],
    );
    const secondarySpocId = vendor.spocs[1]._id!;

    const { code } = await issueOtpChallenge({
      email: "secondary@multi-spoc.example",
      vendorId: vendor._id,
      spocId: secondarySpocId,
      workspaceId,
      requestIp: null,
    });

    const session = await verifyOtp({
      email: "secondary@multi-spoc.example",
      code,
    });
    expect(session).toEqual({
      vendorId: vendor._id.toString(),
      workspaceId: workspaceId.toString(),
      spocId: secondarySpocId.toString(),
    });
  });

  it("an INACTIVE SPOC's email issues no challenge, with the identical byte-for-byte no-enumeration response (ASSESSMENT-WORKFLOW-PLAN.md Stage 2)", async () => {
    await dbConnect();
    await createVendor(
      "inactive-spoc.example",
      "primary@inactive-spoc.example",
      [{ email: "gone@inactive-spoc.example", status: "inactive" }],
    );

    await expect(
      requestOtp({
        email: "gone@inactive-spoc.example",
        requestIp: "127.0.0.1",
      }),
    ).resolves.toBeUndefined();

    const challenge = await OtpChallenge.findOne({
      email: "gone@inactive-spoc.example",
    });
    expect(challenge).toBeNull();
  });

  it("refuses to verify with a valid code once the matched SPOC is deactivated between request and verify", async () => {
    await dbConnect();
    const vendor = await createVendor(
      "deactivated-mid-flow.example",
      "spoc@deactivated-mid-flow.example",
    );
    const { code } = await issueOtpChallenge({
      email: "spoc@deactivated-mid-flow.example",
      vendorId: vendor._id,
      spocId: vendor.spocs[0]._id!,
      workspaceId,
      requestIp: null,
    });

    await Vendor.updateOne(
      { _id: vendor._id },
      { $set: { "spocs.0.status": "inactive" } },
    );

    await expect(
      verifyOtp({ email: "spoc@deactivated-mid-flow.example", code }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("resolves without error and writes nothing for an email that matches no vendor (no enumeration)", async () => {
    await dbConnect();
    await expect(
      requestOtp({
        email: "nobody@unregistered.example",
        requestIp: "127.0.0.1",
      }),
    ).resolves.toBeUndefined();

    const challenge = await OtpChallenge.findOne({
      email: "nobody@unregistered.example",
    });
    expect(challenge).toBeNull();
  });

  it("rate-limits repeated requests for the same email", async () => {
    await dbConnect();
    await createVendor("ratelimit.example", "spoc@ratelimit.example");

    for (let i = 0; i < 5; i++) {
      await requestOtp({
        email: "spoc@ratelimit.example",
        requestIp: `10.0.0.${i}`,
      });
    }
    await expect(
      requestOtp({ email: "spoc@ratelimit.example", requestIp: "10.0.0.99" }),
    ).rejects.toThrow(RateLimitedError);
  });

  it("rate-limits repeated requests from the same IP even across different emails", async () => {
    await dbConnect();
    for (let i = 0; i < 20; i++) {
      await requestOtp({
        email: `vendor-${i}@ip-limit.example`,
        requestIp: "10.0.0.1",
      });
    }
    await expect(
      requestOtp({ email: "one-more@ip-limit.example", requestIp: "10.0.0.1" }),
    ).rejects.toThrow(RateLimitedError);
  });

  it("verifies a correct code and returns the vendor-scoped session payload, consuming the challenge", async () => {
    await dbConnect();
    const vendor = await createVendor("verify.example", "spoc@verify.example");
    const { code } = await issueOtpChallenge({
      email: "spoc@verify.example",
      vendorId: vendor._id,
      spocId: vendor.spocs[0]._id,
      workspaceId,
      requestIp: null,
    });

    const session = await verifyOtp({ email: "spoc@verify.example", code });
    expect(session).toEqual({
      vendorId: vendor._id.toString(),
      workspaceId: workspaceId.toString(),
      spocId: vendor.spocs[0]._id!.toString(),
    });

    const challenge = await OtpChallenge.findOne({
      email: "spoc@verify.example",
    });
    expect(challenge?.consumed_at).not.toBeNull();
  });

  it("rejects a wrong code with a generic error and increments attempts", async () => {
    await dbConnect();
    const vendor = await createVendor(
      "wrongcode.example",
      "spoc@wrongcode.example",
    );
    await issueOtpChallenge({
      email: "spoc@wrongcode.example",
      vendorId: vendor._id,
      spocId: vendor.spocs[0]._id,
      workspaceId,
      requestIp: null,
    });

    await expect(
      verifyOtp({ email: "spoc@wrongcode.example", code: "000000" }),
    ).rejects.toThrow(UnauthorizedError);

    const challenge = await OtpChallenge.findOne({
      email: "spoc@wrongcode.example",
    });
    expect(challenge?.attempts).toBe(1);
  });

  it("locks out after the attempt limit, even with the correct code", async () => {
    await dbConnect();
    const vendor = await createVendor(
      "lockout.example",
      "spoc@lockout.example",
    );
    const { code } = await issueOtpChallenge({
      email: "spoc@lockout.example",
      vendorId: vendor._id,
      spocId: vendor.spocs[0]._id,
      workspaceId,
      requestIp: null,
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        verifyOtp({ email: "spoc@lockout.example", code: "wrong0" }),
      ).rejects.toThrow(UnauthorizedError);
    }

    await expect(
      verifyOtp({ email: "spoc@lockout.example", code }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a code from an expired challenge", async () => {
    await dbConnect();
    const vendor = await createVendor(
      "expired.example",
      "spoc@expired.example",
    );
    const { code, challenge } = await issueOtpChallenge({
      email: "spoc@expired.example",
      vendorId: vendor._id,
      spocId: vendor.spocs[0]._id,
      workspaceId,
      requestIp: null,
    });
    await OtpChallenge.updateOne(
      { _id: challenge._id },
      { $set: { expires_at: new Date(Date.now() - 1000) } },
    );

    await expect(
      verifyOtp({ email: "spoc@expired.example", code }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects replaying an already-consumed code", async () => {
    await dbConnect();
    const vendor = await createVendor("replay.example", "spoc@replay.example");
    const { code } = await issueOtpChallenge({
      email: "spoc@replay.example",
      vendorId: vendor._id,
      spocId: vendor.spocs[0]._id,
      workspaceId,
      requestIp: null,
    });

    await verifyOtp({ email: "spoc@replay.example", code });
    await expect(
      verifyOtp({ email: "spoc@replay.example", code }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects verification for an email with no active challenge at all, with the same generic error", async () => {
    await dbConnect();
    await expect(
      verifyOtp({ email: "never-requested@example.com", code: "123456" }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
