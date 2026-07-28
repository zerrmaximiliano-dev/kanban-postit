-- supabase/migrations/0006_guard_board_owner_fields.sql

-- RLS policies gate rows, not columns: the "editors can update boards" policy
-- from 0005 would otherwise let an editor rewrite owner_id or share_token
-- (e.g. to hijack the invite link) via a direct API call, even though the
-- app's own UI never does this. This trigger closes that column-level gap.
create or replace function guard_board_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.owner_id is distinct from old.owner_id or new.share_token is distinct from old.share_token)
     and board_role(old.id) is distinct from 'owner' then
    raise exception 'Only the board owner can change owner_id or share_token';
  end if;
  return new;
end;
$$;

create trigger boards_before_update_guard_owner_fields
  before update on boards
  for each row execute function guard_board_owner_fields();
