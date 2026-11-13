-- Turns "projects" into ClickUp-style tasks (shown as "Tasks" in the UI; the
-- table keeps its name). Additive only: new columns/tables, and start_date
-- becomes optional. Nothing is dropped.

-- AlterTable
ALTER TABLE "projects"
    ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal',
    ADD COLUMN     "task_type" TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN     "completed_at" TIMESTAMP(3),
    ADD COLUMN     "created_by" INTEGER,
    ALTER COLUMN "start_date" DROP NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'to_do';

-- CreateTable
CREATE TABLE "task_subtasks" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "assignee_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_updates" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_end_date_idx" ON "projects"("end_date");

-- CreateIndex
CREATE INDEX "task_subtasks_project_id_idx" ON "task_subtasks"("project_id");

-- CreateIndex
CREATE INDEX "task_updates_project_id_created_at_idx" ON "task_updates"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_updates" ADD CONSTRAINT "task_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_updates" ADD CONSTRAINT "task_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Convert existing project statuses to the new task statuses
UPDATE "projects" SET "status" = 'in_progress' WHERE "status" = 'active';
UPDATE "projects" SET "status" = 'on_hold'     WHERE "status" = 'on-hold';
UPDATE "projects" SET "completed_at" = "updated_at" WHERE "status" = 'complete' AND "completed_at" IS NULL;
UPDATE "projects" SET "progress" = 100 WHERE "status" = 'complete';
