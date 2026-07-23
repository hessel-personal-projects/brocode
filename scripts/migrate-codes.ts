/**
 * One-time migration script: encrypted codes → PBKDF2 hashes.
 *
 * THIS SCRIPT HAS ALREADY BEEN RUN. The `codeEncrypted` column no longer
 * exists in the schema (dropped in the finalize-code-hash migration).
 * Running this script again will fail immediately with a Prisma validation
 * error. It is kept only for historical reference.
 *
 * If you need to re-run this migration on a database that still has
 * `codeEncrypted` data, restore the schema to the state after
 * migration 20260723091251_add_code_hash_cols (Task 1) and before
 * migration 20260723113303_finalize_code_hash (Task 3).
 */
console.error(
  'ERROR: This migration has already been applied. The codeEncrypted column no longer exists.\n' +
  'See the file header comment for details.'
)
process.exit(1)
