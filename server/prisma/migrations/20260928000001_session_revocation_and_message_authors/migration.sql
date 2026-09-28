-- Lets password resets/changes invalidate access tokens already issued, and
-- keeps ticket chat messages when their author's account is deleted.

-- DropForeignKey
ALTER TABLE "ticket_messages" DROP CONSTRAINT "ticket_messages_user_id_fkey";

-- AlterTable
ALTER TABLE "ticket_messages" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sessions_revoked_at" TIMESTAMPTZ;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

