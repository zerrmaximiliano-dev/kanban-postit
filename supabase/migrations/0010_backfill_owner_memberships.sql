-- supabase/migrations/0010_backfill_owner_memberships.sql

-- 0004_board_members.sql's create_owner_membership trigger only fires on
-- NEW board inserts (`after insert on boards`). Boards created before that
-- migration never got a board_members row for their owner, so the RLS
-- policies from 0005 (which gate access via board_members, not owner_id)
-- silently hid every pre-existing board from its own owner. This backfills
-- the missing owner rows for any board that doesn't already have one.
insert into board_members (board_id, user_id, role, status)
select b.id, b.owner_id, 'owner', 'accepted'
from boards b
where not exists (
  select 1 from board_members bm
  where bm.board_id = b.id and bm.user_id = b.owner_id
)
on conflict (board_id, user_id) do nothing;
