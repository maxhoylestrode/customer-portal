-- A database created by the original database/schema.sql (the live server
-- before Prisma) differs from the baseline migration: several columns Prisma
-- treats as required are nullable, and the foreign keys have different
-- delete behaviour (e.g. deleting a staff user with ticket activity fails
-- instead of nulling the author). This brings such a database in line.
-- Every statement is a no-op on a database built from the migrations.

-- A ticket with no owner can't be shown or safely guessed at; stop and let a
-- human decide rather than deleting a client's ticket.
DO $$
DECLARE orphan_ids TEXT;
BEGIN
  SELECT string_agg(id::text, ', ') INTO orphan_ids FROM "tickets" WHERE "user_id" IS NULL;
  IF orphan_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Tickets with no owner (user_id IS NULL): %. Assign them to a user, then re-run migrations.', orphan_ids;
  END IF;
END $$;

-- Login matches emails case-insensitively, so two accounts that differ only
-- by case would make a sign-in ambiguous. Stop and name them.
DO $$
DECLARE dupes TEXT;
BEGIN
  SELECT string_agg(ids, '; ') INTO dupes FROM (
    SELECT lower(trim("email")) || ' (user ids ' || string_agg(id::text, ', ' ORDER BY id) || ')' AS ids
    FROM "users" GROUP BY lower(trim("email")) HAVING count(*) > 1
  ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Accounts whose emails differ only by capitals: %. Change or remove one of each pair, then re-run migrations.', dupes;
  END IF;
END $$;

-- Rows with no parent are unreachable in the app already
DELETE FROM "attachments" WHERE "ticket_id" IS NULL;
DELETE FROM "ticket_activity" WHERE "ticket_id" IS NULL;
DELETE FROM "refresh_tokens" WHERE "user_id" IS NULL;

UPDATE "users" SET "is_active" = true WHERE "is_active" IS NULL;
UPDATE "users" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;
UPDATE "tickets" SET "scope_flag" = 'unknown' WHERE "scope_flag" IS NULL;
UPDATE "tickets" SET "priority" = 'normal' WHERE "priority" IS NULL;
UPDATE "tickets" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;
UPDATE "tickets" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "attachments" SET "uploaded_at" = CURRENT_TIMESTAMP WHERE "uploaded_at" IS NULL;
UPDATE "ticket_activity" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;
UPDATE "refresh_tokens" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;

ALTER TABLE "users" ALTER COLUMN "is_active" SET NOT NULL, ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "tickets"
  ALTER COLUMN "user_id" SET NOT NULL,
  ALTER COLUMN "scope_flag" SET NOT NULL,
  ALTER COLUMN "priority" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "attachments" ALTER COLUMN "ticket_id" SET NOT NULL, ALTER COLUMN "uploaded_at" SET NOT NULL;
ALTER TABLE "ticket_activity" ALTER COLUMN "ticket_id" SET NOT NULL, ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "user_id" SET NOT NULL, ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_user_id_fkey";
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachments" DROP CONSTRAINT IF EXISTS "attachments_ticket_id_fkey";
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_activity" DROP CONSTRAINT IF EXISTS "ticket_activity_ticket_id_fkey";
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_activity" DROP CONSTRAINT IF EXISTS "ticket_activity_user_id_fkey";
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey";
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Store emails lowercase (no collisions possible after the check above)
UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
