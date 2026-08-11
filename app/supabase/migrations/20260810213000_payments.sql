-- ============================================================================
-- PAYMENTS
--
-- Three tables and two functions. The whole design turns on one requirement:
-- Stripe retries webhooks, sometimes days later, sometimes concurrently, and
-- it does not promise exactly-once delivery. So fulfilment is keyed on
-- `purchases.stripe_session_id` (unique) and every fulfilment path is a no-op
-- the second time it runs.
--
-- Credit packs grant credits ONLY through award_credits(..., 'purchase', ...).
-- `profiles.credits` is a projection guarded by a trigger that raises if you
-- touch it directly (see 20260810203135_integrity_and_reconciliation.sql), and
-- that guard is load-bearing here: a webhook is the single easiest place in the
-- product to invent money that has no ledger row behind it.
--
-- Neither fulfil_purchase nor refund_purchase is callable by anon or
-- authenticated. Supabase exposes every public function as a REST endpoint, and
-- a SECURITY DEFINER function that mints credits is a money printer if a signed
-- in user can POST to it. The Stripe webhook route uses the service-role key,
-- which bypasses RLS and holds the only EXECUTE grant.
-- ============================================================================

create type purchase_status as enum ('pending', 'paid', 'fulfilled', 'refunded', 'failed');

-- Cash tiers only. Credit packs land in credit_ledger, not here — a credit pack
-- buys currency, it does not buy a right against a pod.
create type entitlement_kind as enum ('fast_pod', 'pro', 'rescue');

-- ------------------------------------------------------------------ customers
create table customers (
  user_id            uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text unique not null,
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------------ purchases
create table purchases (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references profiles(id) on delete cascade,
  app_id                uuid references apps(id) on delete set null,
  sku                   text not null,
  amount_cents          integer not null check (amount_cents >= 0),
  currency              text not null default 'usd',
  stripe_session_id     text not null unique,
  stripe_payment_intent text,
  status                purchase_status not null default 'pending',
  -- What the credit pack actually paid out, so a refund can claw back exactly
  -- that and no more. Reading it back off the SKU catalogue would silently
  -- change history the first time we reprice a pack.
  credits_granted       integer not null default 0 check (credits_granted >= 0),
  created_at            timestamptz not null default now(),
  fulfilled_at          timestamptz,
  refunded_at           timestamptz
);
create index on purchases (user_id, created_at desc);
create index on purchases (app_id);
create index on purchases (stripe_payment_intent);

-- --------------------------------------------------------------- entitlements
create table entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  app_id      uuid references apps(id) on delete set null,
  kind        entitlement_kind not null,
  granted_by  uuid references purchases(id) on delete set null,
  consumed_at timestamptz,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on entitlements (user_id);
create index on entitlements (app_id);
create index on entitlements (granted_by);
create index on entitlements (user_id, kind) where consumed_at is null and revoked_at is null;

-- ----------------------------------------------------------------------- RLS
-- One consolidated policy per table per action, `(select auth.uid())` so the
-- lookup is an InitPlan rather than a per-row call, and `to authenticated` so
-- Postgres does not also plan these for anon.
alter table customers    enable row level security;
alter table purchases    enable row level security;
alter table entitlements enable row level security;

create policy "customers select" on customers for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

create policy "purchases select" on purchases for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

create policy "entitlements select" on entitlements for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

-- No insert/update/delete policies anywhere. Money rows are written by the
-- webhook with the service-role key, which bypasses RLS entirely. A user who
-- could insert their own `purchases` row could grant themselves a Pro pod.
revoke all on customers, purchases, entitlements from anon;
revoke insert, update, delete, truncate on customers, purchases, entitlements
  from authenticated;
grant select on customers, purchases, entitlements to authenticated;

-- -------------------------------------------------------- idempotent fulfil --
-- Safe to call twice, ten times, or twice concurrently. Returns a jsonb receipt
-- whose `already` field tells the caller whether this call did the work.
create or replace function fulfil_purchase(
  p_user            uuid,
  p_sku             text,
  p_session         text,
  p_amount_cents    integer,
  p_currency        text    default 'usd',
  p_payment_intent  text    default null,
  p_app             uuid    default null,
  p_credits         integer default 0,
  p_entitlement     entitlement_kind default null,
  p_expires_days    integer default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id      uuid;
  v_status  purchase_status;
  v_balance integer;
begin
  if p_session is null or length(p_session) = 0 then
    raise exception 'fulfil_purchase: stripe_session_id is required';
  end if;

  -- Claim the row. The insert races against a concurrent delivery of the same
  -- event; the unique index on stripe_session_id decides the winner and the
  -- loser falls through to the same locking select.
  begin
    insert into purchases (
      user_id, app_id, sku, amount_cents, currency,
      stripe_session_id, stripe_payment_intent, status
    ) values (
      p_user, p_app, p_sku, coalesce(p_amount_cents, 0), coalesce(p_currency, 'usd'),
      p_session, p_payment_intent, 'paid'
    )
    returning id, status into v_id, v_status;
  exception when unique_violation then
    v_id := null;
  end;

  if v_id is null then
    select id, status into v_id, v_status
      from purchases where stripe_session_id = p_session
      for update;
  end if;

  if v_id is null then
    raise exception 'fulfil_purchase: could not claim session %', p_session;
  end if;

  -- Already done, or refunded and deliberately not being redone.
  if v_status in ('fulfilled', 'refunded') then
    return jsonb_build_object(
      'purchase_id', v_id, 'already', true, 'status', v_status
    );
  end if;

  if p_payment_intent is not null then
    update purchases set stripe_payment_intent = p_payment_intent where id = v_id;
  end if;

  -- Credits. award_credits writes profiles.credits and credit_ledger in one
  -- statement and is the only thing permitted to move a balance.
  if coalesce(p_credits, 0) > 0 then
    v_balance := award_credits(
      p_user, p_credits, 'purchase', 'purchase', v_id,
      format('Credit pack %s', p_sku)
    );
    update purchases set credits_granted = p_credits where id = v_id;
  end if;

  -- Entitlement. One row per paid plan purchase; the pod machinery consumes it.
  if p_entitlement is not null then
    insert into entitlements (user_id, app_id, kind, granted_by, expires_at)
    values (
      p_user, p_app, p_entitlement, v_id,
      case when p_expires_days is null then null
           else now() + make_interval(days => p_expires_days) end
    );
  end if;

  update purchases
     set status = 'fulfilled', fulfilled_at = now()
   where id = v_id;

  return jsonb_build_object(
    'purchase_id', v_id, 'already', false, 'status', 'fulfilled',
    'balance', v_balance
  );
end $$;

-- -------------------------------------------------------- idempotent refund --
-- Keyed on the payment intent, because that is what `charge.refunded` carries.
-- Claws back exactly the credits this purchase granted (floored at zero by
-- award_credits) and revokes any entitlement the buyer has not yet spent. An
-- entitlement already consumed stays consumed: the pod ran, the testers worked.
create or replace function refund_purchase(
  p_payment_intent text,
  p_session        text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id      uuid;
  v_user    uuid;
  v_status  purchase_status;
  v_credits integer;
  v_revoked integer := 0;
begin
  select id, user_id, status, credits_granted
    into v_id, v_user, v_status, v_credits
    from purchases
   where (p_payment_intent is not null and stripe_payment_intent = p_payment_intent)
      or (p_session is not null and stripe_session_id = p_session)
   order by created_at desc
   limit 1
     for update;

  if v_id is null then
    return jsonb_build_object('already', true, 'status', 'unknown');
  end if;

  if v_status = 'refunded' then
    return jsonb_build_object('purchase_id', v_id, 'already', true, 'status', 'refunded');
  end if;

  if coalesce(v_credits, 0) > 0 then
    perform award_credits(
      v_user, -v_credits, 'refund', 'purchase', v_id, 'Refunded credit pack'
    );
  end if;

  update entitlements
     set revoked_at = now()
   where granted_by = v_id and consumed_at is null and revoked_at is null;
  get diagnostics v_revoked = row_count;

  update purchases
     set status = 'refunded', refunded_at = now()
   where id = v_id;

  return jsonb_build_object(
    'purchase_id', v_id, 'already', false, 'status', 'refunded',
    'entitlements_revoked', v_revoked
  );
end $$;

-- ------------------------------------------------------------------- grants --
-- Webhook-only. Nothing signed in gets to call either of these.
revoke execute on function fulfil_purchase(
  uuid, text, text, integer, text, text, uuid, integer, entitlement_kind, integer
) from anon, authenticated, public;
revoke execute on function refund_purchase(text, text) from anon, authenticated, public;
grant execute on function fulfil_purchase(
  uuid, text, text, integer, text, text, uuid, integer, entitlement_kind, integer
) to service_role;
grant execute on function refund_purchase(text, text) to service_role;

-- ---------------------------------------------------------------- read model
-- What the pod machinery asks: does this app have an unspent paid entitlement?
create or replace function active_entitlement(p_app uuid, p_kind entitlement_kind)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (
    select 1 from entitlements
     where app_id = p_app
       and kind = p_kind
       and consumed_at is null
       and revoked_at is null
       and (expires_at is null or expires_at > now())
  );
$$;
revoke execute on function active_entitlement(uuid, entitlement_kind) from anon, public;
grant execute on function active_entitlement(uuid, entitlement_kind) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Follow-up, after running the Supabase security advisor: the advisor flagged
-- `active_entitlement` as a SECURITY DEFINER function callable by signed-in
-- users, and it was right. Exposed at /rest/v1/rpc/active_entitlement, it lets
-- anyone probe whether any app in the pool has a paid entitlement, by app id —
-- commercial information about someone else's launch. The pod machinery runs
-- with the service-role key and does not need the grant; the billing page reads
-- `entitlements` directly under RLS.
revoke execute on function active_entitlement(uuid, entitlement_kind)
  from anon, authenticated, public;
grant execute on function active_entitlement(uuid, entitlement_kind) to service_role;
