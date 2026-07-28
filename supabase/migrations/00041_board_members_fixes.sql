-- supabase/migrations/0004b_board_members_fixes.sql
-- Follow-up fixes from code review of 0004_board_members.sql:
--   1. boards.share_token had no uniqueness guarantee or index.
--   2. security definer functions were executable by PUBLIC (including
--      Supabase's anon role) with no default grant restrictions.

alter table boards add constraint boards_share_token_key unique (share_token);

revoke execute on function is_board_member(uuid) from public;
revoke execute on function board_role(uuid) from public;
revoke execute on function join_board_via_token(uuid) from public;

grant execute on function is_board_member(uuid) to authenticated;
grant execute on function board_role(uuid) to authenticated;
grant execute on function join_board_via_token(uuid) to authenticated;

-- Redefined to add an explicit auth guard: previously an anon caller with a
-- valid token would hit a raw not-null constraint violation on user_id
-- instead of a clean error (an invalid token already raised correctly).
create or replace function join_board_via_token(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

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
