-- supabase/migrations/0013_note_dependencies.sql

create table note_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_note_id uuid not null references notes(id) on delete cascade,
  successor_note_id uuid not null references notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (predecessor_note_id, successor_note_id),
  check (predecessor_note_id <> successor_note_id)
);

alter table note_dependencies enable row level security;

create policy "Members can view dependencies" on note_dependencies
  for select using (
    is_board_member((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    ))
  );

create policy "Owners and editors manage dependencies" on note_dependencies
  for insert with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    )) in ('owner', 'editor')
  );

create policy "Owners and editors delete dependencies" on note_dependencies
  for delete using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    )) in ('owner', 'editor')
  );

-- Same existence-check pattern as 0009_enable_realtime.sql: avoids
-- "relation is already member of publication" if replayed against a
-- project where this was added out-of-band.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_dependencies'
  ) then
    alter publication supabase_realtime add table note_dependencies;
  end if;
end $$;
