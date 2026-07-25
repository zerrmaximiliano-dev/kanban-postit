create table boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid null,
  created_at timestamptz not null default now()
);

create table columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  "order" integer not null default 0
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references columns(id) on delete cascade,
  title text not null,
  description text not null default '',
  color text not null default '#fff59d',
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  tags text[] not null default '{}',
  due_date date null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  "order" integer not null default 0
);

alter table boards enable row level security;
alter table columns enable row level security;
alter table notes enable row level security;
alter table checklist_items enable row level security;

create policy "Owners manage their boards" on boards
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners manage columns of their boards" on columns
  for all using (exists (select 1 from boards b where b.id = columns.board_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from boards b where b.id = columns.board_id and b.owner_id = auth.uid()));

create policy "Owners manage notes in their boards" on notes
  for all using (exists (
    select 1 from columns c join boards b on b.id = c.board_id
    where c.id = notes.column_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from columns c join boards b on b.id = c.board_id
    where c.id = notes.column_id and b.owner_id = auth.uid()
  ));

create policy "Owners manage checklist items in their notes" on checklist_items
  for all using (exists (
    select 1 from notes n
    join columns c on c.id = n.column_id
    join boards b on b.id = c.board_id
    where n.id = checklist_items.note_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from notes n
    join columns c on c.id = n.column_id
    join boards b on b.id = c.board_id
    where n.id = checklist_items.note_id and b.owner_id = auth.uid()
  ));
