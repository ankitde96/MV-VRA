/**
 * PLAN.md Phase 7 item 6 — "Orphaned upload handling." A file can end up in storage with
 * no `Response` document referencing it (the metadata-patch step failed after a successful
 * upload — DATA-MODEL.md §5's accepted failure mode, "fail toward the orphan") or, less
 * commonly, a `Response` can reference a key that no longer exists in storage (manual
 * deletion, a botched migration). This script reports both, and only *deletes* orphaned
 * files, and only when `--delete` is passed explicitly.
 *
 * Dry-run by default — this only ever reports until told otherwise. Run as
 * `npm run sweep:evidence` (dry-run) or `npm run sweep:evidence -- --delete`.
 */
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { Response } from "@/lib/db/models/response";
import { Vendor } from "@/lib/db/models/vendor";
import { getStorageDriver } from "@/lib/storage";

async function main() {
  const shouldDelete = process.argv.includes("--delete");

  await dbConnect();

  const responses = await Response.find({}, { evidence: 1 }).lean();
  const responseEvidenceKeys = new Set(
    responses.flatMap((r) => r.evidence.map((e) => e.file_key)),
  );

  const vendors = await Vendor.find({}, { documents: 1 }).lean();
  const vendorDocumentKeys = new Set(
    vendors.flatMap((v) => v.documents.map((d) => d.key)),
  );

  const referencedKeys = new Set([
    ...responseEvidenceKeys,
    ...vendorDocumentKeys,
  ]);

  const storage = getStorageDriver();
  const allKeys = await storage.list("");

  const orphanedKeys = allKeys.filter((key) => !referencedKeys.has(key));
  const brokenReferences = [...referencedKeys].filter(
    (key) => !allKeys.includes(key),
  );

  console.log(`Storage objects: ${allKeys.length}`);
  console.log(
    `Referenced (responses + vendor documents): ${referencedKeys.size}`,
  );
  console.log(`Orphaned files (no owning record): ${orphanedKeys.length}`);
  for (const key of orphanedKeys) console.log(`  orphan: ${key}`);

  if (brokenReferences.length > 0) {
    console.log(
      `\nBroken references (record points at a missing file) — NOT auto-fixed: ${brokenReferences.length}`,
    );
    for (const key of brokenReferences) console.log(`  broken: ${key}`);
  }

  if (orphanedKeys.length === 0) {
    console.log("\nNothing to clean up.");
  } else if (!shouldDelete) {
    console.log(
      "\nDry run — pass --delete to actually remove the orphaned files listed above.",
    );
  } else {
    console.log("\nDeleting orphaned files...");
    for (const key of orphanedKeys) {
      await storage.delete(key);
      console.log(`  deleted: ${key}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
