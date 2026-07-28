-- supabase/migrations/0014_note_dependencies_same_board_check.sql

-- Code review of 0013 found that the insert policy only validated the
-- predecessor note's board, never confirming the successor note is on the
-- SAME board — letting an editor on Board A insert a dependency pointing at
-- an arbitrary note on Board B, which they have no membership in at all.
-- This migration adds a same-board equality check to all three policies.

drop policy "Members can view dependencies" on note_dependencies;
drop policy "Owners and editors manage dependencies" on note_dependencies;
drop policy "Owners and editors delete dependencies" on note_dependencies;

create policy "Members can view dependencies" on note_dependencies
  for select using (
    is_board_member((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    ))
    and (
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    ) = (
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.successor_note_id
    )
  );

create policy "Owners and editors manage dependencies" on note_dependencies
  for insert with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    )) in ('owner', 'editor')
    and (
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    ) = (
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.successor_note_id
    )
  );

create policy "Owners and editors delete dependencies" on note_dependencies
  for delete using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    )) in ('owner', 'editor')
    and (
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.successor_note_id
    ) is not null
  );
