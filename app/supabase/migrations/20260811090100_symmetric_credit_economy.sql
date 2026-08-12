-- ============================================================================
-- SYMMETRIC CREDIT ECONOMY
--
-- Until now credits were minted: a tester earned for work, and nobody paid for
-- it. That inflates without limit, and it prices the core loop at zero, so the
-- currency only meant anything at the edges (buffers, rescues, priority).
--
-- Credits now move sideways instead of appearing. Every credit a tester earns
-- comes out of the balance of the developer whose app they tested:
--
--   confirmed install (closed-track opt-in)   tester +10   app owner -10
--   confirmed report  (private feedback)      tester +30   app owner -30
--
-- The arithmetic of a full pod is why those numbers work. A 15-seat pod gives
-- every member 14 testers and asks them to test 14 apps:
--
--   as a developer:  14 x (10 + 30) = 560 paid out
--   as a tester:     14 x (10 + 30) = 560 earned
--
-- Anyone who does their share breaks exactly even. Slacking costs you; doing
-- more than your share earns. The currency is conserved, so it cannot inflate,
-- and the signup grant is raised to cover one full pod so a new developer is
-- never stuck unable to afford the testers they are simultaneously earning
-- from.
--
-- TWO THINGS THAT ARE DELIBERATE AND MUST NOT BE "FIXED":
--
-- 1. The report charge is FLAT. A blocker-severity report costs the developer
--    exactly what a glowing one costs — 30. If critical feedback were more
--    expensive, every developer would learn to dispute it, and creator review
--    would become the positivity machine this product was built against. The
--    blocker bounty stays funded by the platform for the same reason: the
--    person who finds the worst bug must never be the person who costs the
--    developer the most.
--
-- 2. "Install" here means a closed testing track opt-in and "report" means a
--    private structured report. Neither is, nor can become, a public store
--    install, rating or review. No credit in this file attaches to a public
--    store action, and none ever may.
-- ============================================================================

-- --------------------------------------------------------------- new prices
update economy_config set value = 30,
       note = 'Private structured report. FLAT — severity never changes it, or creator review becomes a positivity machine.'
 where key = 'feedback_approved';

update economy_config set value = 600,
       note = 'Covers one full pod of testing (14 x 40 = 560) plus a margin, so a new developer is never stuck.'
 where key = 'signup_grant';

update economy_config set value = 20,
       note = 'Raised from 5: the daily cap is the real throttle now, and 5 made ten installs a day unreachable.'
 where key = 'max_concurrent_assignments';

-- Check-ins and the streak bonus stop paying credits.
--
-- This is what makes the economy actually balanced rather than nominally
-- balanced. If a check-in still minted 5 a day, testing one app would pay
-- 10 + 30 + 70 + 20 = 130 while costing its developer 40 — every tested app
-- would create 90 credits from nothing, and a full pod would inflate the
-- supply by 1,260. The currency would be worthless within a month.
--
-- Showing up daily is still the single most important thing a tester does, and
-- it is still tracked, streaked and enforced — through RELIABILITY, which gates
-- pod access below 40 and drives the tier badge, rather than through credits.
-- Missing days is now punished rather than attendance being bribed, which is
-- also the cheaper of the two to run.
update economy_config set value = 0,
       note = 'Paid nothing. Attendance drives reliability and the streak, not the balance — see the note on install_charge.'
 where key = 'daily_checkin';

update economy_config set value = 0,
       note = 'A badge, not a payment. Minting it would break conservation for the same reason daily_checkin does.'
 where key = 'streak_bonus_full';

-- Platform-funded, and cut so it no longer dwarfs the report it accompanies.
-- It stays platform-funded because the developer must never pay more for the
-- tester who found the worst bug.
update economy_config set value = 15,
       note = 'Funded by us, never by the developer. Half a report, so finding a blocker is a bonus and not a jackpot.'
 where key = 'bug_bounty_blocker';

insert into economy_config (key, value, note) values
  ('install_charge',      10, 'Charged to the app owner when a tester''s closed-track opt-in is confirmed. Mirrors opt_in_verified exactly.'),
  ('review_charge',       30, 'Charged to the app owner when a report is approved. FLAT across severities, on purpose.'),
  ('daily_install_cap',   10, 'Confirmed installs a free member may bank per day. Unlimited on the paid pass.'),
  ('daily_review_cap',    10, 'Reports a free member may submit per day. Unlimited on the paid pass.'),
  ('default_pod_seats',   15, 'Seats in a free pod. 12 required by Google, so three can drop out and it still clears.')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- A developer whose balance ran dry mid-pod. Their testers were still paid;
-- what stops is the app taking on NEW work until they top up.
alter table apps add column if not exists credits_paused boolean not null default false;
create index if not exists apps_credits_paused_idx on apps (owner_id) where credits_paused;

-- ---------------------------------------------------------------------------
-- The paid pass
-- ---------------------------------------------------------------------------
-- True while the member holds an unexpired, unrevoked 'unlimited' entitlement.
-- Deliberately not consumed: it is a window of time, so `consumed_at` stays
-- null for its whole life and expiry alone ends it.
create or replace function has_unlimited_testing(p_user uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (
    select 1 from entitlements
     where user_id = p_user
       and kind = 'unlimited'
       and revoked_at is null
       and (expires_at is null or expires_at > now())
  )
$$;

-- Not callable by `authenticated`, even though it only returns a boolean and
-- moves no money: it takes a user id, and Supabase publishes every public
-- function as a REST endpoint, so granting it would let any signed-in member
-- enumerate who is subscribed. The UI reads testing_quota() instead, which
-- answers only for its own caller.
revoke execute on function has_unlimited_testing(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Daily throttle
-- ---------------------------------------------------------------------------
-- Counted from the source tables rather than the ledger, because the cap has to
-- bite at the moment work is SUBMITTED — before the developer has confirmed it
-- and before any credit has moved. Telling a tester "you are over your limit"
-- after they have installed an app and written a report would be the worst
-- possible moment to say it.
--
-- "Day" is UTC. The pod clock, the check-in day and the cron jobs are all UTC
-- already; a per-user local midnight would give members in some time zones a
-- longer day than others.
create or replace function _installs_today(p_user uuid)
returns integer language sql stable security definer
set search_path = public, extensions as $$
  select count(*)::int from assignments
   where tester_id = p_user
     and opt_in_verified_at >= date_trunc('day', now() at time zone 'utc')
$$;

create or replace function _reviews_today(p_user uuid)
returns integer language sql stable security definer
set search_path = public, extensions as $$
  select count(*)::int from feedback
   where tester_id = p_user
     and status <> 'draft'
     and submitted_at >= date_trunc('day', now() at time zone 'utc')
$$;

revoke execute on function _installs_today(uuid) from anon, authenticated, public;
revoke execute on function _reviews_today(uuid)  from anon, authenticated, public;

-- What the UI reads to draw "7 of 10 today". Takes no argument and answers only
-- for the caller, so it is safe to expose: it cannot be pointed at anyone else.
create or replace function testing_quota()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_user uuid := auth.uid(); v_unlimited boolean;
begin
  if v_user is null then raise exception 'not signed in'; end if;
  v_unlimited := has_unlimited_testing(v_user);
  return jsonb_build_object(
    'unlimited',      v_unlimited,
    'installs_today', _installs_today(v_user),
    'reviews_today',  _reviews_today(v_user),
    'install_cap',    case when v_unlimited then null else cfg('daily_install_cap') end,
    'review_cap',     case when v_unlimited then null else cfg('daily_review_cap') end
  );
end $$;

revoke execute on function testing_quota() from anon, public;
grant  execute on function testing_quota() to authenticated;

-- The cap is enforced by triggers, not by the Server Action that normally
-- writes these rows. Supabase exposes every table over REST, so a check that
-- lives only in application code is a check a determined farmer can POST around.
create or replace function guard_daily_review_cap()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  -- Only a fresh submission counts. Editing a draft, or a moderator moving a
  -- row through its statuses, must never trip the throttle.
  if new.status = 'draft' then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then return new; end if;

  -- The counter keys off submitted_at, so a row that leaves 'draft' without one
  -- is invisible to every later count — and a REST client can post exactly that.
  -- Stamping it here rather than trusting the caller is what makes the cap a
  -- cap rather than a suggestion.
  if new.submitted_at is null then new.submitted_at := now(); end if;

  if has_unlimited_testing(new.tester_id) then return new; end if;

  -- Serialise per tester before counting. Two requests that both read "9 so
  -- far" would both be allowed through, and on the install side that is two
  -- credit transfers past the limit. The lock is released at commit and is
  -- taken on the tester's own id, so it never blocks anybody else.
  perform pg_advisory_xact_lock(hashtext('review_cap:' || new.tester_id::text));

  if _reviews_today(new.tester_id) >= cfg('daily_review_cap') then
    raise exception 'daily_review_cap'
      using hint = 'Free members send ' || cfg('daily_review_cap') ||
                   ' reports a day. Your limit resets at midnight UTC.';
  end if;
  return new;
end $$;

drop trigger if exists trg_daily_review_cap on feedback;
create trigger trg_daily_review_cap
  before insert or update on feedback
  for each row execute function guard_daily_review_cap();

create or replace function guard_daily_install_cap()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.opt_in_verified_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.opt_in_verified_at is not null then return new; end if;

  if has_unlimited_testing(new.tester_id) then return new; end if;

  -- Same race, same fix as the report cap. Here it matters more: every install
  -- past the limit is 10 credits out of an app owner's balance.
  perform pg_advisory_xact_lock(hashtext('install_cap:' || new.tester_id::text));

  if _installs_today(new.tester_id) >= cfg('daily_install_cap') then
    raise exception 'daily_install_cap'
      using hint = 'Free members bank ' || cfg('daily_install_cap') ||
                   ' installs a day. Your limit resets at midnight UTC.';
  end if;
  return new;
end $$;

drop trigger if exists trg_daily_install_cap on assignments;
create trigger trg_daily_install_cap
  before insert or update on assignments
  for each row execute function guard_daily_install_cap();

-- ---------------------------------------------------------------------------
-- Charging the app owner
-- ---------------------------------------------------------------------------
-- The tester is ALWAYS paid. They did the work; whether the developer budgeted
-- for it is not their problem and must never become their problem.
--
-- So a developer who cannot cover a charge is taken to zero rather than
-- refused, and their app is paused instead. That caps the shortfall at one
-- charge per app, keeps the ledger honest about what was actually taken, and
-- puts the consequence on the person who ran the balance down.
create or replace function _charge_owner(
  p_app uuid, p_amount integer, p_reason ledger_reason,
  p_ref_type text, p_ref_id uuid, p_memo text
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_owner uuid; v_balance integer; v_take integer;
begin
  if coalesce(p_amount, 0) <= 0 then return true; end if;

  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null then return false; end if;

  select credits into v_balance from profiles where id = v_owner for update;
  v_take := least(coalesce(v_balance, 0), p_amount);

  if v_take > 0 then
    perform award_credits(v_owner, -v_take, p_reason, p_ref_type, p_ref_id, p_memo);
  end if;

  if v_take < p_amount then
    update apps set credits_paused = true where id = p_app and not credits_paused;
    insert into notifications (user_id, kind, payload, dedupe_key)
    values (v_owner, 'credits_exhausted',
            jsonb_build_object('app_id', p_app, 'short_by', p_amount - v_take),
            'credits_exhausted:' || p_app)
    on conflict do nothing;
    return false;
  end if;

  return true;
end $$;

revoke execute on function _charge_owner(uuid,integer,ledger_reason,text,uuid,text)
  from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Confirmed install: the transfer
-- ---------------------------------------------------------------------------
-- A trigger rather than a line inside admin_review_proof, because four separate
-- paths set opt_in_verified_at — the moderator queue, the auto-approving vision
-- triage, the admin backfill, and the rescue seeder. Hanging the payment off
-- the column transition means none of them can forget.
--
-- `credits_paid` is stamped here so the escrow release at pod completion, which
-- pays only rows with credits_paid = 0, skips a seat that has already been paid.
create or replace function on_optin_confirmed()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_amount integer;
begin
  if new.opt_in_verified_at is null then return new; end if;
  if old.opt_in_verified_at is not null then return new; end if;
  if new.credits_paid > 0 then return new; end if;

  v_amount := cfg('opt_in_verified');

  perform _charge_owner(new.app_id, cfg('install_charge'), 'install_charge',
                        'assignment', new.id, 'Confirmed install');
  perform award_credits(new.tester_id, v_amount, 'opt_in_verified',
                        'assignment', new.id, 'Confirmed install');

  new.credits_paid := v_amount;
  return new;
end $$;

drop trigger if exists trg_optin_confirmed on assignments;
create trigger trg_optin_confirmed
  before update on assignments
  for each row execute function on_optin_confirmed();

-- ---------------------------------------------------------------------------
-- Confirmed report: the transfer
-- ---------------------------------------------------------------------------
-- Redefined rather than triggered, because the two verdicts do genuinely
-- different things and the dispute branch must stay exactly as it was: a
-- verdict of anything other than 'useful' opens a moderator dispute. It does
-- not reject the report, and it does not save the developer the charge.
create or replace function review_feedback(p_feedback uuid, p_verdict text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid; v_tester uuid; v_app uuid; v_sev int; v_pay int; v_bounty int := 0;
  v_status feedback_status;
begin
  -- `for update of f` locks the report for the length of this transaction.
  -- Without it a repeated call — a double-clicked button, a retried request —
  -- runs the whole transfer again. Credits stay conserved each time, so no
  -- balance inflates and no alarm fires; the app owner is simply charged twice
  -- for one report. The lock plus the terminal-status check below is what makes
  -- a second call a no-op instead of a second bill.
  select a.owner_id, f.tester_id, f.app_id, f.severity, f.status
    into v_owner, v_tester, v_app, v_sev, v_status
    from feedback f join apps a on a.id = f.app_id
   where f.id = p_feedback
     for update of f;
  if v_owner is null then raise exception 'unknown feedback'; end if;
  if v_owner <> auth.uid() and not exists (select 1 from profiles where id = auth.uid() and is_moderator) then
    raise exception 'not your app';
  end if;

  if v_status <> 'submitted' then
    return jsonb_build_object('ok', false, 'error', 'already_reviewed',
      'message', 'That report has already been dealt with.');
  end if;

  if p_verdict = 'useful' then
    v_pay := cfg('feedback_approved');
    -- Severity changes what the PLATFORM adds, never what the developer pays.
    if v_sev >= 3 then v_bounty := cfg('bug_bounty_blocker'); end if;

    update feedback set status = 'approved', creator_verdict = 'useful', creator_note = p_note,
           reviewed_at = now(), credits_awarded = v_pay + v_bounty where id = p_feedback;

    perform _charge_owner(v_app, cfg('review_charge'), 'review_charge',
                          'feedback', p_feedback, 'Confirmed report');
    perform award_credits(v_tester, v_pay, 'feedback_approved', 'feedback', p_feedback);
    if v_bounty > 0 then
      perform award_credits(v_tester, v_bounty, 'bug_bounty', 'feedback', p_feedback,
                            'Blocker-severity bug with repro steps');
    end if;
    perform recompute_reliability(v_tester);
    return jsonb_build_object('ok', true, 'credits', v_pay + v_bounty);
  else
    update feedback set status = 'disputed', creator_verdict = p_verdict, creator_note = p_note,
           reviewed_at = now() where id = p_feedback;
    insert into disputes (feedback_id, raised_by, reason) values (p_feedback, v_owner, coalesce(p_note, p_verdict));
    return jsonb_build_object('ok', true, 'disputed', true,
      'message', 'Sent to a moderator. Critical feedback still gets paid if it is specific.');
  end if;
end $$;

revoke execute on function review_feedback(uuid,text,text) from anon, public;
grant  execute on function review_feedback(uuid,text,text) to authenticated;

-- A report that survives arbitration is paid by the developer who disputed it,
-- at the same flat rate. Losing the dispute must cost what accepting it would
-- have cost — otherwise disputing is a free option and everyone takes it.
create or replace function arbitrate_dispute(p_dispute uuid, p_uphold boolean, p_resolution text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_fb uuid; v_tester uuid; v_app uuid; v_pay int; v_dstatus dispute_status;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_moderator) then
    raise exception 'moderators only';
  end if;

  -- Same reasoning as review_feedback: arbitrating twice would charge the app
  -- owner twice for one report.
  select d.feedback_id, f.tester_id, f.app_id, d.status
    into v_fb, v_tester, v_app, v_dstatus
    from disputes d join feedback f on f.id = d.feedback_id
   where d.id = p_dispute
     for update of d;

  if v_fb is null then raise exception 'unknown dispute'; end if;
  if v_dstatus <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'already_resolved',
      'message', 'That dispute has already been resolved.');
  end if;

  if p_uphold then
    update feedback set status = 'rejected' where id = v_fb;
    update disputes set status = 'upheld', resolver_id = auth.uid(),
           resolution = p_resolution, resolved_at = now() where id = p_dispute;
  else
    v_pay := cfg('feedback_approved');
    update feedback set status = 'arbitrated', credits_awarded = v_pay where id = v_fb;
    perform _charge_owner(v_app, cfg('review_charge'), 'review_charge',
                          'feedback', v_fb, 'Report upheld on arbitration');
    perform award_credits(v_tester, v_pay, 'arbitration_award', 'feedback', v_fb, 'Overturned on arbitration');
    update disputes set status = 'overturned', resolver_id = auth.uid(),
           resolution = p_resolution, resolved_at = now() where id = p_dispute;
  end if;
  perform recompute_reliability(v_tester);
  return jsonb_build_object('ok', true, 'upheld', p_uphold);
end $$;

revoke execute on function arbitrate_dispute(uuid,boolean,text) from anon, public;
grant  execute on function arbitrate_dispute(uuid,boolean,text) to authenticated;

-- ---------------------------------------------------------------------------
-- A paused app cannot take on new work
-- ---------------------------------------------------------------------------
create or replace function join_pod(p_app uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid; v_pod uuid; v_count int; v_rel numeric; v_active int;
  v_kind entitlement_kind; v_seats int; v_min_rel numeric := 0; v_priority boolean := false;
  v_balance int; v_needed int;
begin
  if not coalesce((select enabled from feature_flags where key = 'pod_matching'), true) then
    return jsonb_build_object('ok', false, 'error', 'matching_paused',
      'message', 'Pod matching is paused right now. Nothing you have done is lost; try again shortly.');
  end if;

  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'not your app'; end if;

  if exists (select 1 from apps where id = p_app and credits_paused) then
    return jsonb_build_object('ok', false, 'error', 'credits_paused',
      'message', 'This app ran out of credits. Top up or earn some by testing, and it can join again.');
  end if;

  select reliability into v_rel from profiles where id = v_owner;
  if v_rel < 40 then
    return jsonb_build_object('ok', false, 'error', 'reliability_too_low',
      'message', 'Your reliability score is too low to join a pod. Serve as a rescue tester to rebuild it.');
  end if;

  select count(*) into v_active from assignments
   where tester_id = v_owner and status in ('opt_in_pending','active');
  if v_active >= cfg('max_concurrent_assignments') then
    return jsonb_build_object('ok', false, 'error', 'too_many_active',
      'message', 'Finish your current tests first. Real testing beats farming.');
  end if;

  v_kind := _consume_entitlement(v_owner, p_app);
  if v_kind = 'pro' then
    v_seats := 20; v_min_rel := 85; v_priority := true;
  elsif v_kind = 'fast_pod' then
    v_seats := 18; v_priority := true;
  else
    -- 15 seats: Google needs 12 testers, and three can drop out without the
    -- pod failing. Carried forward from the previous definition as
    -- `select core_seats from pods limit 0`, which returns no rows and left
    -- v_seats null for every free member — so the seat filter below stopped
    -- filtering and a free app could be matched into an 18 or 20-seat paid pod.
    v_seats := cfg('default_pod_seats');
  end if;

  -- What this pod will cost the developer: every seat but their own tests their
  -- app, and each of those testers earns an install plus a report. Returned as
  -- a warning, never a gate — blocking here would strand the developer who has
  -- run their balance down and can only rebuild it by testing, which requires
  -- being in a pod.
  v_needed := (cfg('install_charge') + cfg('review_charge')) * (coalesce(v_seats, 15) - 1);
  select credits into v_balance from profiles where id = v_owner;

  select p.id into v_pod
    from pods p
   where p.status = 'forming'
     and p.is_priority = v_priority
     and (v_seats is null or p.core_seats = v_seats)
     and (select count(*) from pod_members m where m.pod_id = p.id) < p.core_seats
     and not exists (select 1 from pod_members m where m.pod_id = p.id and m.user_id = v_owner)
     and (v_min_rel = 0 or not exists (
           select 1 from pod_members m join profiles pr on pr.id = m.user_id
            where m.pod_id = p.id and pr.reliability < v_min_rel))
   order by (select count(*) from pod_members m where m.pod_id = p.id) desc
   limit 1;

  if v_pod is null then
    insert into pods (name, core_seats, is_priority)
    values ('Pod ' || to_char(now(), 'Mon DD'), coalesce(v_seats, 15), v_priority)
    returning id into v_pod;
  end if;

  insert into pod_members (pod_id, user_id, app_id, seat, status)
  values (v_pod, v_owner, p_app, 'core', 'joined')
  on conflict (pod_id, user_id) do nothing;

  update apps set status = 'queued' where id = p_app;

  select count(*) into v_count from pod_members where pod_id = v_pod;
  return jsonb_build_object(
    'ok', true, 'pod_id', v_pod, 'members', v_count,
    'seats', (select core_seats from pods where id = v_pod),
    'tier', coalesce(v_kind::text, 'free'),
    'priority', v_priority,
    'cost_estimate', v_needed,
    'balance', v_balance,
    'underfunded', v_balance < v_needed);
end $$;

revoke execute on function join_pod(uuid) from anon, public;
grant  execute on function join_pod(uuid) to authenticated;

-- Any balance at all clears the pause, whether it arrived from a credit pack, a
-- refund, an admin adjustment or an afternoon of testing other people's apps.
-- A trigger rather than a call inside fulfil_purchase, because "has money
-- again" is the real condition and there are five ways to reach it. If the
-- balance runs out again, _charge_owner simply pauses it again.
create or replace function unpause_on_topup()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.credits > 0 and old.credits <= 0 then
    update apps set credits_paused = false where owner_id = new.id and credits_paused;
  end if;
  return new;
end $$;

drop trigger if exists profiles_unpause_on_topup on profiles;
create trigger profiles_unpause_on_topup
  after update of credits on profiles
  for each row execute function unpause_on_topup();

-- Manual override for the admin tools.
create or replace function unpause_apps_for(p_user uuid)
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare v_n integer;
begin
  update apps set credits_paused = false where owner_id = p_user and credits_paused;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function unpause_apps_for(uuid) from anon, authenticated, public;
grant  execute on function unpause_apps_for(uuid) to service_role;
