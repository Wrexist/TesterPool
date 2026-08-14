-- ============================================================================
-- THE OWNER'S SIDE OF ACTIVITIES, MADE SETTABLE
--
-- `accepting_activities` and `activity_target` shipped as live columns with
-- defaults and no way for a developer to change either. They are the two things
-- an owner is actually consenting to — whether strangers may pick their app up,
-- and how many — so leaving them settable only by a migration meant the consent
-- was assumed rather than given.
--
-- Through an RPC rather than an RLS policy on `apps`, for the rule in CLAUDE.md:
-- the client may never write a column that an RPC reads when deciding to move
-- credits. `start_activity` reads both of these to decide whether to create a
-- seat, and a seat is 40 credits out of this owner's balance.
--
-- The exposure here is genuinely different from the payment columns that rule
-- was written for — the person writing is the person being charged, so raising
-- the target only ever means "I agree to pay for more", and there is no way to
-- reach into a stranger's listing. That is an argument for the RPC being simple,
-- not for skipping it: the guard is the same shape as every other one here, and
-- the next column added beside these will inherit it rather than have to
-- rediscover the reasoning.
-- ============================================================================

create or replace function set_activity_intake(
  p_app       uuid,
  p_accepting boolean default null,
  p_target    integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_owner uuid; v_accepting boolean; v_target integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_app');
  end if;
  if v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_app');
  end if;

  -- Null means "leave this one alone", so the two controls can be moved
  -- independently without the UI having to send both.
  update apps
     set accepting_activities = coalesce(p_accepting, accepting_activities),
         -- Clamped rather than rejected. The check constraint would refuse an
         -- out-of-range value with a constraint violation, which is a worse
         -- thing for a developer to read than simply landing on the maximum.
         activity_target      = least(50, greatest(0, coalesce(p_target, activity_target))),
         updated_at           = now()
   where id = p_app
   returning accepting_activities, activity_target into v_accepting, v_target;

  return jsonb_build_object('ok', true, 'accepting', v_accepting, 'target', v_target);
end $$;

revoke execute on function set_activity_intake(uuid, boolean, integer)
  from anon, public;
grant  execute on function set_activity_intake(uuid, boolean, integer)
  to authenticated;
