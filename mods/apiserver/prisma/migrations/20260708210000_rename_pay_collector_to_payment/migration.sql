/*
  Data migration (issue #163): the "pay-collector" automation (shipped
  2026-07-06) was generalized and renamed to "payment", with its
  `collectorId` static slot renamed to `employeeId`. Any Task/TaskFiring row
  created in the two days between those releases still carries the old
  automation id and JSON key — rename both so existing rows keep resolving
  against the live catalog instead of degrading to NEEDS_INPUT with
  "Automatización desconocida: pay-collector".
*/

-- Tasks: rename the collectorId key to employeeId inside static_params_json
-- before flipping automation_id, so we only touch rows that actually have it.
UPDATE "tasks"
SET "static_params_json" = json_remove(
  json_set("static_params_json", '$.employeeId', json_extract("static_params_json", '$.collectorId')),
  '$.collectorId'
)
WHERE "automation_id" = 'pay-collector'
  AND json_extract("static_params_json", '$.collectorId') IS NOT NULL;

UPDATE "tasks"
SET "automation_id" = 'payment'
WHERE "automation_id" = 'pay-collector';

-- TaskFirings: same key rename inside payload_json, plus the missing-slots
-- list (a NEEDS_INPUT firing may list "collectorId" as a missing slot name).
UPDATE "task_firings"
SET "payload_json" = json_remove(
  json_set("payload_json", '$.employeeId', json_extract("payload_json", '$.collectorId')),
  '$.collectorId'
)
WHERE "automation_id" = 'pay-collector'
  AND json_extract("payload_json", '$.collectorId') IS NOT NULL;

UPDATE "task_firings"
SET "missing_slots_json" = REPLACE("missing_slots_json", '"collectorId"', '"employeeId"')
WHERE "automation_id" = 'pay-collector'
  AND "missing_slots_json" LIKE '%collectorId%';

UPDATE "task_firings"
SET "automation_id" = 'payment'
WHERE "automation_id" = 'pay-collector';
