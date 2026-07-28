-- supabase/migrations/0012_enable_realtime_board_members.sql

-- MembersPopover.tsx subscribes to postgres_changes on board_members to
-- notify a viewer when their edit request is approved. Supabase only
-- delivers those events for tables in the supabase_realtime publication —
-- 0009_enable_realtime.sql added columns/notes/checklist_items but not
-- board_members, so without this the notification would silently never fire.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_members'
  ) then
    alter publication supabase_realtime add table board_members;
  end if;
end $$;
