-- supabase/migrations/0011_edit_requests_and_display_names.sql

alter table board_members add column display_name text null;
alter table board_members add column edit_requested boolean not null default false;

-- Backfill: any existing row missing invited_email (owner rows created by the
-- trigger before this fix, or share-link joins before this fix) gets it filled
-- from auth.users. Safe to run multiple times (no-op once populated).
update board_members bm
set invited_email = u.email
from auth.users u
where bm.user_id = u.id and bm.invited_email is null;

-- Capture the owner's email at membership-creation time from now on.
create or replace function create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email text;
begin
  select email into owner_email from auth.users where id = new.owner_id;
  insert into board_members (board_id, user_id, role, status, invited_email)
  values (new.id, new.owner_id, 'owner', 'accepted', owner_email);
  return new;
end;
$$;

-- Capture the joiner's email at share-link join time from now on.
create or replace function join_board_via_token(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
  joiner_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into target_board_id from boards where share_token = token;
  if target_board_id is null then
    raise exception 'Invalid share link';
  end if;

  select email into joiner_email from auth.users where id = auth.uid();

  insert into board_members (board_id, user_id, role, status, invited_email)
  values (target_board_id, auth.uid(), 'viewer', 'accepted', joiner_email)
  on conflict (board_id, user_id) do nothing;

  return target_board_id;
end;
$$;

-- Members can update their own row (needed so a viewer can set edit_requested,
-- and any member can set display_name, without going through the owner).
create policy "Members can update their own membership row" on board_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RLS can't restrict which COLUMNS an update touches, only which ROWS. The
-- policy above would otherwise let a viewer PATCH their own role to 'editor'
-- directly. This trigger closes that: any change to role/invited_email/status
-- requires the caller to be the board's owner, regardless of which policy let
-- the UPDATE through. board_role() looks up the caller's own role via
-- auth.uid(), so this doesn't affect the owner's normal "change someone else's
-- role" path (their board_role() really is 'owner').
create or replace function guard_member_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.invited_email is distinct from old.invited_email
      or new.status is distinct from old.status)
     and board_role(old.board_id) is distinct from 'owner' then
    raise exception 'Only the board owner can change role, email, or status';
  end if;
  return new;
end;
$$;

create trigger board_members_before_update_guard_self
  before update on board_members
  for each row execute function guard_member_self_update();
