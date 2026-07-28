-- supabase/migrations/0007_checklist_items_replica_identity.sql

-- Postgres's default REPLICA IDENTITY only includes primary-key columns in
-- DELETE payloads sent over logical replication (which Supabase Realtime's
-- postgres_changes feature uses). useBoardRealtime.ts needs note_id on
-- checklist_item DELETE events to know which note's checklist to update —
-- FULL identity includes every column, not just the primary key.
alter table checklist_items replica identity full;
