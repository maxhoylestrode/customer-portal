#!/usr/bin/env node
// Runs before `prisma migrate deploy` on every container start.
//
// A database restored from the old (pre-Prisma) server already has the
// tables the baseline migration would create, but no migration history, so
// `migrate deploy` would try to create them again and fail. Detect exactly
// that case and record the baseline as applied; the reconcile migration that
// runs next then fixes the small differences in the old schema.

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const BASELINE = '20260924000000_baseline';

async function main() {
  const prisma = new PrismaClient();
  let legacy;
  try {
    const [row] = await prisma.$queryRaw`
      SELECT to_regclass('public.users') IS NOT NULL
         AND to_regclass('public._prisma_migrations') IS NULL AS legacy`;
    legacy = row.legacy;
  } finally {
    await prisma.$disconnect();
  }

  if (legacy) {
    console.log(`Existing pre-Prisma database found: marking ${BASELINE} as already applied.`);
    execSync(`npx prisma migrate resolve --applied ${BASELINE}`, { stdio: 'inherit' });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
