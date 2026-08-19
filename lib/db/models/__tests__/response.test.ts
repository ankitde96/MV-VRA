// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Response } from "@/lib/db/models/response";

describe("Response schema", () => {
  it("hydrates a document written before evidence_flags with an empty array", async () => {
    const response = Response.hydrate({
      _id: new Types.ObjectId(),
      workspace_id: new Types.ObjectId(),
      assessment_id: new Types.ObjectId(),
      control_id: "CTRL-1",
      question_text: "Legacy response",
      evidence: [],
    });

    expect(response.evidence_flags).toEqual([]);
    await expect(response.validate()).resolves.toBeUndefined();
  });
});
