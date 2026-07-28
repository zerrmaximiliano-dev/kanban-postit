-- supabase/migrations/0005_membership_rls.sql

drop policy "Owners manage their boards" on boards;

create policy "Members can view boards they belong to" on boards
  for select using (is_board_member(id));

create policy "Authenticated users can create boards" on boards
  for insert with check (owner_id = auth.uid());

create policy "Owners and editors can update boards" on boards
  for update using (board_role(id) in ('owner', 'editor'))
  with check (board_role(id) in ('owner', 'editor'));

create policy "Owners can delete boards" on boards
  for delete using (board_role(id) = 'owner');

drop policy "Owners manage columns of their boards" on columns;

create policy "Members can view columns" on columns
  for select using (is_board_member(board_id));

create policy "Owners and editors manage columns" on columns
  for insert with check (board_role(board_id) in ('owner', 'editor'));

create policy "Owners and editors update columns" on columns
  for update using (board_role(board_id) in ('owner', 'editor'))
  with check (board_role(board_id) in ('owner', 'editor'));

create policy "Owners and editors delete columns" on columns
  for delete using (board_role(board_id) in ('owner', 'editor'));

drop policy "Owners manage notes in their boards" on notes;

create policy "Members can view notes" on notes
  for select using (
    is_board_member((select board_id from columns where id = notes.column_id))
  );

create policy "Owners and editors manage notes" on notes
  for insert with check (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  );

create policy "Owners and editors update notes" on notes
  for update using (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  )
  with check (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  );

create policy "Owners and editors delete notes" on notes
  for delete using (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  );

drop policy "Owners manage checklist items in their notes" on checklist_items;

create policy "Members can view checklist items" on checklist_items
  for select using (
    is_board_member((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    ))
  );

create policy "Owners and editors manage checklist items" on checklist_items
  for insert with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  );

create policy "Owners and editors update checklist items" on checklist_items
  for update using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  )
  with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  );

create policy "Owners and editors delete checklist items" on checklist_items
  for delete using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  );
