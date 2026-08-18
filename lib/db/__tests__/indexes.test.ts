// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose, { type Model } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import * as models from "@/lib/db/models";

function isModel(value: unknown): value is Model<unknown> {
  return (
    typeof value === "function" &&
    typeof (value as Model<unknown>).modelName === "string" &&
    typeof (value as Model<unknown>).syncIndexes === "function"
  );
}

const modelList = Object.values(models).filter(isModel);

/**
 * PLAN.md Phase 1, step 6: "every declared index exists after sync." Compares each model's
 * schema.index() declarations against what mongod actually built, rather than hardcoding a
 * separate expected list that could silently drift from the schema files.
 */
describe("index sync (integration)", () => {
  beforeAll(async () => {
    await dbConnect();
    for (const model of modelList) {
      await model.syncIndexes();
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("discovered at least one model to check", () => {
    expect(modelList.length).toBeGreaterThan(0);
  });

  it.each(modelList.map((m) => [m.modelName, m] as const))(
    "every index declared on %s exists after syncIndexes()",
    async (_name, model) => {
      const declared = model.schema.indexes().map(([keys]) => keys);
      const live = await model.collection.indexes();
      const liveKeys = live.map((idx) => idx.key);

      for (const declaredKey of declared) {
        const matches = liveKeys.some(
          (liveKey) => JSON.stringify(liveKey) === JSON.stringify(declaredKey),
        );
        expect(
          matches,
          `expected an index matching ${JSON.stringify(declaredKey)}`,
        ).toBe(true);
      }
    },
  );
});
