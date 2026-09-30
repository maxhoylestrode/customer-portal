-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "data" BYTEA,
ADD COLUMN     "mimetype" VARCHAR(255);

-- AlterTable
ALTER TABLE "client_files" ADD COLUMN     "data" BYTEA;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "avatar_data" BYTEA,
ADD COLUMN     "avatar_mimetype" TEXT;

-- AlterTable
ALTER TABLE "storage_files" ADD COLUMN     "data" BYTEA;

-- CreateTable
CREATE TABLE "branding" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "portal_name" TEXT NOT NULL DEFAULT 'Apex Portal',
    "logo_data" BYTEA,
    "logo_mimetype" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_pkey" PRIMARY KEY ("id")
);

