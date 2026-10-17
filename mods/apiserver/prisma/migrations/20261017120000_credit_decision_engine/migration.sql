-- Credit decision engine (add-credit-decision-engine): bureau facts pushed by
-- the Mikro Decisión extension (keyed by cédula, facts + raw hash only) and
-- the append-only credit policy decisions per application. The new
-- ApplicationRejectionReason value CREDIT_POLICY needs no SQL (SQLite TEXT).

[dotenv@17.2.3] injecting env (0) from ../../.env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }
-- CreateTable
CREATE TABLE "credit_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cedula" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "raw_sha256" TEXT NOT NULL,
    "adapter_version" TEXT NOT NULL,
    "portal_origin" TEXT NOT NULL,
    "captured_at" DATETIME NOT NULL,
    "captured_by_id" TEXT NOT NULL,
    "application_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "credit_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "policy_hash" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "mikro_score" INTEGER,
    "reasons" JSONB NOT NULL,
    "unchecked" JSONB NOT NULL,
    "components" JSONB NOT NULL,
    "next_steps" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "trace" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_decisions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "credit_reports_cedula_source_captured_at_idx" ON "credit_reports"("cedula", "source", "captured_at");

-- CreateIndex
CREATE INDEX "credit_decisions_application_id_created_at_idx" ON "credit_decisions"("application_id", "created_at");

