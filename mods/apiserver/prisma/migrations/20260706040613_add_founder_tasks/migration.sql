-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "weekday" INTEGER,
    "day_of_month" INTEGER,
    "on_date" TEXT,
    "time_of_day" TEXT NOT NULL,
    "static_params_json" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_fire_at" DATETIME,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "task_firings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT,
    "automation_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "missing_slots_json" TEXT,
    "context_json" TEXT,
    "reason" TEXT,
    "due_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "resolved_by_id" TEXT,
    CONSTRAINT "task_firings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "tasks_enabled_next_fire_at_idx" ON "tasks"("enabled", "next_fire_at");

-- CreateIndex
CREATE INDEX "task_firings_task_id_status_idx" ON "task_firings"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_firings_status_idx" ON "task_firings"("status");
