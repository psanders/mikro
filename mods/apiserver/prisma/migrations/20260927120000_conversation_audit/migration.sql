-- CreateTable: conversation audit runs + findings (openspec add-conversation-audit)
CREATE TABLE "conversation_audit_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trigger" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "window_start" DATETIME,
    "first_turn_id" INTEGER,
    "last_turn_id" INTEGER,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "turns" INTEGER NOT NULL DEFAULT 0,
    "handoffs" INTEGER NOT NULL DEFAULT 0,
    "failed_sends" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "judged" INTEGER NOT NULL DEFAULT 0,
    "judge_skipped" INTEGER NOT NULL DEFAULT 0,
    "judge_errors" INTEGER NOT NULL DEFAULT 0,
    "by_agent" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT
);

-- CreateTable
CREATE TABLE "conversation_audit_findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "application_id" TEXT,
    "customer_id" TEXT,
    "profile" TEXT,
    "agent_name" TEXT,
    "agent_version" TEXT,
    "check_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "turn_id" INTEGER,
    "evidence" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_audit_findings_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "conversation_audit_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "conversation_audit_runs_status_started_at_idx" ON "conversation_audit_runs"("status", "started_at");

-- CreateIndex
CREATE INDEX "conversation_audit_findings_run_id_idx" ON "conversation_audit_findings"("run_id");

-- CreateIndex
CREATE INDEX "conversation_audit_findings_phone_idx" ON "conversation_audit_findings"("phone");
