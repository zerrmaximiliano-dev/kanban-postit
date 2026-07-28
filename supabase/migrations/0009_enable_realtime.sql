-- supabase/migrations/0008_enable_realtime.sql

-- useBoardRealtime.ts subscribes to postgres_changes on these three tables.
-- Supabase only delivers those events for tables that are members of the
-- supabase_realtime publication — without this, a fresh project replaying
-- these migrations from scratch would have realtime silently never fire,
-- with no error to point at the cause.
--
-- Wrapped in existence checks: if a table was already added to the
-- publication out-of-band (e.g. via the Supabase dashboard on the current
-- dev project), `alter publication ... add table` raises "relation is
-- already member of publication" rather than no-op'ing, which would break
-- this migration when replayed against that project.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'columns'
  ) then
    alter publication supabase_realtime add table columns;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table notes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checklist_items'
  ) then
    alter publication supabase_realtime add table checklist_items;
  end if;
end $$;
