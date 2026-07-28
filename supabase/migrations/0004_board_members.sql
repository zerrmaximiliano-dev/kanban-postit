-- supabase/migrations/0004_board_members.sql

create table board_members (
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

alter table boards add column share_token uuid not null default gen_random_uuid();

alter table board_members enable row level security;

-- security definer functions: these run with the privileges of their owner
-- (not the calling user), which is the documented way to check membership
-- of the same table a policy is protecting without Postgres reporting
-- "infinite recursion detected in policy" for a self-referential EXISTS.
create or replace function is_board_member(target_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from board_members
    where board_id = target_board_id and user_id = auth.uid()
  );
$$;

create or replace function board_role(target_board_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from board_members
  where board_id = target_board_id and user_id = auth.uid()
  limit 1;
$$;

-- Every board gets its owner's membership row created automatically.
-- Runs as security definer so it can insert before any board_members
-- row exists yet for this board (the normal INSERT policy below requires
-- board_role() = 'owner', which would otherwise be impossible for the
-- very first row of a brand new board).
create or replace function create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into board_members (board_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'accepted');
  return new;
end;
$$;

create trigger boards_after_insert_owner_membership
  after insert on boards
  for each row execute function create_owner_membership();

create policy "Members can view their board's member list" on board_members
  for select using (is_board_member(board_id));

create policy "Owners can add members" on board_members
  for insert with check (board_role(board_id) = 'owner');

create policy "Owners can change member roles" on board_members
  for update using (board_role(board_id) = 'owner') with check (board_role(board_id) = 'owner');

create policy "Owners can remove members" on board_members
  for delete using (board_role(board_id) = 'owner');

-- Lets a logged-in user join a board via its share link as a viewer,
-- without needing a permissive "anyone can insert themselves" policy
-- that would let them pick their own role.
create or replace function join_board_via_token(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
begin
  select id into target_board_id from boards where share_token = token;
  if target_board_id is null then
    raise exception 'Invalid share link';
  end if;

  insert into board_members (board_id, user_id, role, status)
  values (target_board_id, auth.uid(), 'viewer', 'accepted')
  on conflict (board_id, user_id) do nothing;

  return target_board_id;
end;
$$;
