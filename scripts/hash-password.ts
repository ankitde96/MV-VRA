/**
 * Generates a SUPER_ADMIN_PASSWORD_HASH value. Never hardcode a real password anywhere in
 * this repo — this script exists so the project owner can produce a hash locally and paste
 * it into .env.local, then re-run `npm run db:seed` to replace the Phase 1 placeholder hash
 * (which cannot authenticate by design).
 *
 * Usage: npm run hash-password -- '<the password>'
 */
import argon2 from "argon2";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: npm run hash-password -- '<the password>'");
    process.exit(1);
  }

  const hash = await argon2.hash(password);
  console.log(hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
