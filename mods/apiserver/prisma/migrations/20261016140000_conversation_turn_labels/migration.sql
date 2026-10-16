-- Decision-model labels on CX turns (openspec conversation-state). Additive
-- and nullable: older releases ignore the columns, so a rollback is safe.
ALTER TABLE "conversation_turns" ADD COLUMN "intent" TEXT;
ALTER TABLE "conversation_turns" ADD COLUMN "intent_confidence" REAL;
ALTER TABLE "conversation_turns" ADD COLUMN "classification" TEXT;
