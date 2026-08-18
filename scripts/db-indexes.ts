/**
 * Explicit index sync — DATA-MODEL.md §6. autoIndex stays off outside development, so this
 * is the only thing that applies declared indexes in staging/production. Run as
 * `npm run db:indexes`.
 */
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

async function main() {
  await dbConnect();

  const modelList = Object.values(models).filter(isModel);

  for (const model of modelList) {
    console.log(`Syncing indexes for ${model.modelName}...`);
    await model.syncIndexes();
  }

  console.log(`Done. ${modelList.length} model(s) synced.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
