-- Retire the watch-rule feature.
--
-- Watch rules were founder-defined threshold alerts ("avísame si la mora de una
-- ruta pasa de 9%") created conversationally through the copilot. The feature
-- shipped but was never adopted: no rule was ever created and no `rule.alert`
-- business event was ever emitted. It is being removed rather than carried.
--
-- `business_events` is otherwise append-only history that we never delete from.
-- `rule.alert` is a deliberate exception, confirmed with the product owner: the
-- type was never used in practice, so there is no history worth preserving —
-- only rows that would render as an event type the app no longer understands.
-- Removing the type from the catalog while leaving its rows behind would bake
-- in exactly that inconsistency.
DELETE FROM "business_events" WHERE "type" = 'rule.alert';

DROP INDEX IF EXISTS "watch_rules_enabled_idx";
DROP TABLE IF EXISTS "watch_rules";
