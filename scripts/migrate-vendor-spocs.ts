/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 (D2) — backfills `Vendor.spocs[]` from the legacy
 * single `Vendor.spoc` object for any vendor that predates this stage. Additive-only: no
 * `deleteMany`, no unguarded `updateMany` (`CONSTRAINTS.md` #3) — every write here targets
 * one specific vendor id matched by an empty/missing `spocs` array, and only ever pushes,
 * never removes. The legacy `spoc` field is left untouched (`DECISIONS.md` 042).
 *
 * Idempotent: re-running matches nothing once every vendor has at least one `spocs[]`
 * entry, so it is safe to run repeatedly or as part of a deploy step.
 *
 * Run as `npm run migrate:vendor-spocs`.
 */
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Vendor } from "@/lib/db/models/vendor";

async function main() {
  await dbConnect();

  const candidates = await Vendor.find({
    $or: [{ spocs: { $exists: false } }, { spocs: { $size: 0 } }],
  });

  if (candidates.length === 0) {
    console.log("No vendors need a spocs[] backfill.");
    await mongoose.disconnect();
    return;
  }

  let migrated = 0;
  for (const vendor of candidates) {
    // Matched again by `_id` + the same empty/missing condition, so a vendor that gained
    // a real spocs[] entry between the find above and this write (e.g. an admin added one
    // by hand) is skipped rather than overwritten.
    const result = await Vendor.updateOne(
      {
        _id: vendor._id,
        $or: [{ spocs: { $exists: false } }, { spocs: { $size: 0 } }],
      },
      {
        $set: {
          spocs: [
            {
              name: vendor.spoc.spoc_name,
              email: vendor.spoc.spoc_email,
              phone: vendor.spoc.spoc_phone,
              is_primary: true,
              status: "active",
            },
          ],
        },
      },
    );
    if (result.modifiedCount > 0) {
      migrated += 1;
      console.log(`  migrated: ${vendor._id} (${vendor.spoc.spoc_email})`);
    }
  }

  console.log(`\n${migrated} vendor(s) backfilled.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
