#!/usr/bin/env node
/**
 * One-time migration helper: copies ticket attachments that still only
 * exist as files on disk (from before file storage moved into Postgres)
 * into the `attachments.data` column, so they survive redeploys like
 * everything else.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... UPLOAD_DIR=/path/to/old/uploads \
 *     node scripts/backfill-attachments.js
 *
 * - DATABASE_URL should point at the database you want to backfill
 *   (run this against the old server's DB before migrating it, or
 *   against the new CapRover DB after restoring the dump into it —
 *   either works, since it only touches rows where data IS NULL).
 * - UPLOAD_DIR should point at a copy of the old server's `server/uploads`
 *   directory (the one referenced by `att.filepath`).
 *
 * Safe to re-run: only attachments with `data IS NULL` are touched, and
 * a file that can't be found is skipped (reported, not deleted or failed).
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const UPLOAD_DIR = process.env.UPLOAD_DIR;

if (!UPLOAD_DIR) {
  console.error('UPLOAD_DIR is required — point it at the old server/uploads directory.');
  process.exit(1);
}

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

function guessMimetype(filename) {
  return EXT_MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const pending = await prisma.attachment.findMany({
      where: { data: null },
      select: { id: true, ticketId: true, filename: true, filepath: true, mimetype: true },
    });

    console.log(`Found ${pending.length} attachment(s) not yet backed by DB bytes.`);

    let backfilled = 0;
    const missing = [];

    for (const att of pending) {
      const filePath = path.join(UPLOAD_DIR, att.filepath);
      if (!fs.existsSync(filePath)) {
        missing.push({ id: att.id, ticketId: att.ticketId, filename: att.filename, expectedAt: filePath });
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      await prisma.attachment.update({
        where: { id: att.id },
        data: {
          data: buffer,
          mimetype: att.mimetype || guessMimetype(att.filename),
        },
      });
      backfilled++;
      console.log(`  backfilled #${att.id} (ticket ${att.ticketId}): ${att.filename} (${buffer.length} bytes)`);
    }

    console.log(`\nDone. Backfilled ${backfilled}/${pending.length}.`);
    if (missing.length > 0) {
      console.warn(`\n${missing.length} attachment(s) had no file on disk — their DB row is unchanged, they'll still 404 if downloaded:`);
      for (const m of missing) {
        console.warn(`  #${m.id} (ticket ${m.ticketId}) "${m.filename}" — expected at ${m.expectedAt}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
