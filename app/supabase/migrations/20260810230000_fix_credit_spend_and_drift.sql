-- ============================================================================
-- Two bugs found by verification, both in the same blind spot: what the
-- `authenticated` role can and cannot reach over PostgREST.
--
-- 1. EVERY CREDIT SPEND IN THE PRODUCT WAS BROKEN.
--
--    `harden_rpc_surface` correctly revoked EXECUTE on `spend_credits` from
--    `authenticated` — it takes a user id and an amount, so leaving it callable
--    is a money printer. But the Server Action behind the buffer seat, rescue
--    seat, priority pod, expert seat and extra app buttons went on calling it
--    with the *user's* session, which is exactly the role that lost the grant.
--    Every one of those buttons returned "permission denied for function
--    spend_credits". The revoke was right; the caller was never updated.
--
--    The fix is the shape this codebase already uses for `claim_rescue`: an
--    RPC that takes no user id and no amount. The buyer is `auth.uid()`, the
--    price is read from `economy_config` server-side, and the config key is
--    checked against a fixed allowlist so it cannot be pointed at some other
--    row (`signup_grant` is also an integer in that table). Nothing the caller
--    sends can change who pays or how much.
--
-- 2. `ledger_drift()` HANDED EVERY BALANCE TO EVERY SIGNED-IN USER.
--
--    It is a SECURITY DEFINER function granted to `authenticated`, and unlike
--    its neighbours `admin_cron_status` and `admin_secret_presence` it carried
--    no `is_admin()` predicate. Exposed at /rest/v1/rpc/ledger_drift it handed
--    any signed-in caller the handle and credit balance of every account whose
--    cached balance disagrees with its ledger. The grant stays — the admin
--    system page calls it with the admin's own session — and the guard is added
--    where the two functions beside it already have theirs.
-- ============================================================================

/* ------------------------------------------------------- spending credits */

-- The five things credits buy. Key -> the ledger reason it is recorded under.
-- Kept in the function rather than a table so that adding a spendable item is
-- a migration with a review, not an UPDATE.
create or replace function purchase_upgrade(p_key text, p_app uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_reason ledger_reason;
  v_price int;
  v_balance int;
begin
  if v_user is null then raise exception 'not signed in'; end if;

  v_reason := case p_key
    when 'cost_buffer_seat'  then 'buffer_seat_spend'
    when 'cost_rescue_seat'  then 'rescue_seat_spend'
    when 'cost_priority_pod' then 'priority_spend'
    when 'cost_expert_seat'  then 'expert_seat_spend'
    when 'cost_extra_app'    then 'extra_app_spend'
    else null
  end::ledger_reason;

  if v_reason is null then
    return jsonb_build_object('ok', false, 'error', 'bad_request',
      'message', 'That is not something credits buy.');
  end if;

  -- An app-scoped purchase is written into the ledger against that app, so it
  -- has to be the buyer's own app or the reference is a lie.
  if p_app is not null and not exists (
       select 1 from apps where id = p_app and owner_id = v_user) then
    raise exception 'not your app';
  end if;

  v_price := cfg(p_key);
  if v_price is null then
    return jsonb_build_object('ok', false, 'error', 'no_config',
      'message', 'That option is not available right now.');
  end if;

  if not spend_credits(v_user, v_price, v_reason,
                       case when p_app is null then null else 'app' end, p_app) then
    select credits into v_balance from profiles where id = v_user;
    return jsonb_build_object('ok', false, 'error', 'insufficient',
      'price', v_price, 'balance', coalesce(v_balance, 0),
      'needed', greatest(0, v_price - coalesce(v_balance, 0)),
      'message', 'You need ' || greatest(0, v_price - coalesce(v_balance, 0)) || ' more credits.');
  end if;

  select credits into v_balance from profiles where id = v_user;
  return jsonb_build_object('ok', true, 'spent', v_price, 'balance', v_balance);
end $$;

revoke execute on function purchase_upgrade(text, uuid) from anon, public;
grant  execute on function purchase_upgrade(text, uuid) to authenticated;

/* ------------------------------------------------------------ ledger drift */

create or replace function ledger_drift()
returns table (user_id uuid, handle extensions.citext, projected integer, ledger integer, drift integer)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.handle, p.credits, coalesce(l.total, 0)::integer,
         (p.credits - coalesce(l.total, 0))::integer
    from profiles p
    left join (select cl.user_id, sum(cl.delta) total from credit_ledger cl group by cl.user_id) l
      on l.user_id = p.id
   where is_admin()
     and p.credits <> coalesce(l.total, 0)
$$;

revoke execute on function ledger_drift() from anon, public;
grant  execute on function ledger_drift() to authenticated;
