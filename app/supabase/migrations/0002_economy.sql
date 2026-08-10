-- ============================================================================
-- COHORT — the economy
--
-- Earn rates are tuned so that ONE full cycle of honest tester work (verified
-- opt-in + 14 daily opens + one approved feedback report) pays exactly what ONE
-- buffer seat costs. The pod itself is barter and needs no currency; credits
-- only price the edges — buffers, rescues, priority, expert seats. That keeps
-- the currency non-inflationary without a rake, which is precisely where
-- OnTopRank's 1:1 star economy fails (no sink, therefore nothing to sell).
-- ============================================================================

create table economy_config (
  key   text primary key,
  value integer not null,
  note  text not null default ''
);

insert into economy_config (key, value, note) values
  ('signup_grant',        150, 'Starter credits. Enough for one buffer seat, so the first taste is free.'),
  ('opt_in_verified',      10, 'Escrowed at opt-in, released on pod completion. Discourages opt-in-and-vanish.'),
  ('daily_checkin',         5, '5 x 14 = 70. The bulk of tester earnings, paid for the thing Google actually grades.'),
  ('streak_bonus_full',    20, 'Paid only on a perfect 14/14. Makes the last day worth as much as the first.'),
  ('feedback_approved',    40, 'Structured, on-rubric feedback. The safest and most valuable mechanic we have.'),
  ('bug_bounty_blocker',   60, 'Severity 3 with reproduction steps. Bonus on top of feedback_approved.'),
  ('rescue_bonus',         50, 'Joining a pod mid-cycle to replace a dropout. Premium because the clock is cruel.'),
  ('referral_referrer',    75, 'Paid when the referee finishes their first pod, not on signup. Kills fake invites.'),
  ('referral_referee',     50, 'The other half of the invite.'),
  ('referral_tithe_pct',    5, 'Referrer earns 5%% of referee earnings forever. Compounding, sticky, cheap.'),

  ('cost_buffer_seat',    145, 'One extra tester beyond the pod default. ~= one full cycle of tester work.'),
  ('cost_rescue_seat',    260, 'Emergency replacement, matched within hours. Priced above a buffer on purpose.'),
  ('cost_priority_pod',   400, 'Skip the forming queue; start within 24h.'),
  ('cost_expert_seat',    300, 'A platinum-tier tester in your category who writes long-form feedback.'),
  ('cost_extra_app',      200, 'Second and subsequent apps. First app is always free.'),

  ('penalty_dropout',     120, 'Deducted when you abandon a pod mid-cycle. You broke 14 other people''s clocks.'),
  ('max_concurrent_assignments', 5, 'Hard cap. Prevents credit farming and keeps testing attention real.')
on conflict (key) do nothing;

create or replace function cfg(k text) returns integer
language sql stable as $$ select value from economy_config where key = k $$;

-- ---------------------------------------------------------------------------
-- Atomic credit movement. The ledger is the source of truth; profiles.credits
-- is a cached projection updated in the same statement.
-- ---------------------------------------------------------------------------
create or replace function award_credits(
  p_user   uuid,
  p_delta  integer,
  p_reason ledger_reason,
  p_ref_type text default null,
  p_ref_id   uuid default null,
  p_memo     text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_delta = 0 then
    select credits into v_balance from profiles where id = p_user;
    return v_balance;
  end if;

  update profiles
     set credits = greatest(0, credits + p_delta),
         updated_at = now()
   where id = p_user
  returning credits into v_balance;

  if not found then
    raise exception 'award_credits: no such profile %', p_user;
  end if;

  insert into credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, memo)
  values (p_user, p_delta, v_balance, p_reason, p_ref_type, p_ref_id, p_memo);

  -- Referral tithe: the referrer earns a permanent cut of positive earnings.
  -- Minted, not deducted from the referee — the referee never feels taxed.
  if p_delta > 0 and p_reason in ('daily_checkin','feedback_approved','bug_bounty','streak_bonus','rescue_bonus') then
    perform _pay_tithe(p_user, p_delta);
  end if;

  return v_balance;
end $$;

create or replace function _pay_tithe(p_user uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_cut integer; v_bal integer;
begin
  select referred_by into v_ref from profiles where id = p_user;
  if v_ref is null then return; end if;

  v_cut := floor(p_delta * cfg('referral_tithe_pct') / 100.0);
  if v_cut <= 0 then return; end if;

  update profiles set credits = credits + v_cut where id = v_ref returning credits into v_bal;
  insert into credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, memo)
  values (v_ref, v_cut, v_bal, 'referral_tithe', 'profile', p_user, 'Tithe on referee earnings');
end $$;

-- Spend with a balance guard. Returns false rather than throwing so the UI can
-- render a friendly "you need N more credits" state.
create or replace function spend_credits(
  p_user uuid, p_amount integer, p_reason ledger_reason,
  p_ref_type text default null, p_ref_id uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  select credits into v_balance from profiles where id = p_user for update;
  if v_balance is null or v_balance < p_amount then return false; end if;
  perform award_credits(p_user, -p_amount, p_reason, p_ref_type, p_ref_id);
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Reliability score — the load-bearing reputation number.
--
-- Dropping out mid-pod is THE failure mode of every peer testing network: it
-- resets a stranger's 14-day clock and costs them a month. So reliability is
-- weighted brutally against dropouts and gates access to pods.
-- ---------------------------------------------------------------------------
create or replace function recompute_reliability(p_user uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_completed int; v_dropped int; v_days int; v_expected int;
  v_feedback int; v_rejected int; v_score numeric;
begin
  select pods_completed, pods_dropped into v_completed, v_dropped
    from profiles where id = p_user;

  select coalesce(sum(days_checked_in),0),
         coalesce(sum(case when status in ('active','graduated','dropped') then 14 else 0 end),0)
    into v_days, v_expected
    from assignments where tester_id = p_user;

  select count(*) filter (where status = 'approved'),
         count(*) filter (where status = 'rejected')
    into v_feedback, v_rejected
    from feedback where tester_id = p_user;

  -- Base 70 for newcomers so they can get into a pod at all, then evidence moves it.
  v_score := 70
    + least(15, v_completed * 3)                                        -- finished pods
    + case when v_expected > 0 then (v_days::numeric / v_expected) * 15 else 0 end  -- attendance
    + least(10, v_feedback * 1.5)                                       -- useful feedback
    - v_dropped * 25                                                    -- the cardinal sin
    - v_rejected * 4;                                                   -- low-effort feedback

  v_score := greatest(0, least(100, v_score));

  update profiles set
    reliability = v_score,
    tier = case
      when v_score >= 92 and v_completed >= 6 then 'platinum'::tier
      when v_score >= 85 and v_completed >= 3 then 'gold'::tier
      when v_score >= 75 and v_completed >= 1 then 'silver'::tier
      else 'bronze'::tier end,
    updated_at = now()
  where id = p_user;

  return v_score;
end $$;

-- ---------------------------------------------------------------------------
-- Daily check-in. Awards on the spot, pays the perfect-attendance bonus on 14.
-- ---------------------------------------------------------------------------
create or replace function submit_checkin(
  p_assignment uuid, p_proof uuid default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tester uuid; v_start timestamptz; v_day int; v_today date;
  v_days int; v_pay int; v_bonus int := 0;
begin
  select a.tester_id, p.starts_at into v_tester, v_start
    from assignments a join pods p on p.id = a.pod_id
   where a.id = p_assignment;

  if v_tester is null then raise exception 'unknown assignment'; end if;
  if v_tester <> auth.uid() then raise exception 'not your assignment'; end if;
  if v_start is null then raise exception 'pod has not started'; end if;

  v_today := (now() at time zone 'utc')::date;
  v_day := (v_today - (v_start at time zone 'utc')::date) + 1;
  if v_day < 1 then raise exception 'pod has not started'; end if;

  if exists (select 1 from checkins where assignment_id = p_assignment and checkin_date = v_today) then
    return jsonb_build_object('ok', false, 'error', 'already_checked_in_today');
  end if;

  v_pay := cfg('daily_checkin');
  insert into checkins (assignment_id, day_number, checkin_date, proof_id, note, credits_awarded)
  values (p_assignment, v_day, v_today, p_proof, p_note, v_pay);

  update assignments
     set days_checked_in = days_checked_in + 1,
         last_checkin_on = v_today,
         status = 'active'
   where id = p_assignment
  returning days_checked_in into v_days;

  perform award_credits(v_tester, v_pay, 'daily_checkin', 'assignment', p_assignment);

  if v_days >= 14 then
    v_bonus := cfg('streak_bonus_full');
    perform award_credits(v_tester, v_bonus, 'streak_bonus', 'assignment', p_assignment,
                          'Perfect 14/14 attendance');
  end if;

  update profiles
     set current_streak = current_streak + 1,
         longest_streak = greatest(longest_streak, current_streak + 1)
   where id = v_tester;

  perform recompute_reliability(v_tester);

  return jsonb_build_object('ok', true, 'day', v_day, 'days_total', v_days,
                            'credits', v_pay + v_bonus, 'perfect', v_days >= 14);
end $$;

-- ---------------------------------------------------------------------------
-- Feedback review.
--
-- 'useful' pays. 'low_effort' / 'off_rubric' does NOT auto-reject — it opens a
-- dispute for a moderator. A creator can never silently withhold credit from a
-- tester who told them something they didn't want to hear.
-- ---------------------------------------------------------------------------
create or replace function review_feedback(
  p_feedback uuid, p_verdict text, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_tester uuid; v_sev int; v_pay int; v_bounty int := 0;
begin
  select a.owner_id, f.tester_id, f.severity
    into v_owner, v_tester, v_sev
    from feedback f join apps a on a.id = f.app_id
   where f.id = p_feedback;

  if v_owner is null then raise exception 'unknown feedback'; end if;
  if v_owner <> auth.uid() and not exists (
      select 1 from profiles where id = auth.uid() and is_moderator) then
    raise exception 'not your app';
  end if;

  if p_verdict = 'useful' then
    v_pay := cfg('feedback_approved');
    if v_sev >= 3 then v_bounty := cfg('bug_bounty_blocker'); end if;

    update feedback set status = 'approved', creator_verdict = 'useful',
           creator_note = p_note, reviewed_at = now(),
           credits_awarded = v_pay + v_bounty
     where id = p_feedback;

    perform award_credits(v_tester, v_pay, 'feedback_approved', 'feedback', p_feedback);
    if v_bounty > 0 then
      perform award_credits(v_tester, v_bounty, 'bug_bounty', 'feedback', p_feedback,
                            'Blocker-severity bug with repro steps');
    end if;
    perform recompute_reliability(v_tester);
    return jsonb_build_object('ok', true, 'credits', v_pay + v_bounty);
  else
    update feedback set status = 'disputed', creator_verdict = p_verdict,
           creator_note = p_note, reviewed_at = now()
     where id = p_feedback;
    insert into disputes (feedback_id, raised_by, reason)
    values (p_feedback, v_owner, coalesce(p_note, p_verdict));
    return jsonb_build_object('ok', true, 'disputed', true,
      'message', 'Sent to a moderator. Critical feedback still gets paid if it is specific.');
  end if;
end $$;

-- Moderator arbitration of a disputed feedback report.
create or replace function arbitrate_dispute(
  p_dispute uuid, p_uphold boolean, p_resolution text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fb uuid; v_tester uuid; v_pay int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_moderator) then
    raise exception 'moderators only';
  end if;

  select d.feedback_id, f.tester_id into v_fb, v_tester
    from disputes d join feedback f on f.id = d.feedback_id where d.id = p_dispute;

  if p_uphold then
    -- Creator was right: the report really was low effort. No credit, small rep hit.
    update feedback set status = 'rejected' where id = v_fb;
    update disputes set status = 'upheld', resolver_id = auth.uid(),
           resolution = p_resolution, resolved_at = now() where id = p_dispute;
  else
    -- Tester was right. Pay in full and note it.
    v_pay := cfg('feedback_approved');
    update feedback set status = 'arbitrated', credits_awarded = v_pay where id = v_fb;
    perform award_credits(v_tester, v_pay, 'arbitration_award', 'feedback', v_fb,
                          'Overturned on arbitration');
    update disputes set status = 'overturned', resolver_id = auth.uid(),
           resolution = p_resolution, resolved_at = now() where id = p_dispute;
  end if;

  perform recompute_reliability(v_tester);
  return jsonb_build_object('ok', true, 'upheld', p_uphold);
end $$;

-- ---------------------------------------------------------------------------
-- Matchmaking: place an app into a forming pod, or open a new one.
-- Enforces the two hard rules — nobody tests their own app, and nobody holds
-- more concurrent assignments than they can honestly service.
-- ---------------------------------------------------------------------------
create or replace function join_pod(p_app uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_pod uuid; v_count int; v_rel numeric; v_active int;
begin
  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'not your app'; end if;

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

  -- Find a forming pod with a free seat that this user is not already in.
  select p.id into v_pod
    from pods p
   where p.status = 'forming'
     and (select count(*) from pod_members m where m.pod_id = p.id) < p.core_seats
     and not exists (select 1 from pod_members m where m.pod_id = p.id and m.user_id = v_owner)
   order by (select count(*) from pod_members m where m.pod_id = p.id) desc
   limit 1;

  if v_pod is null then
    insert into pods (name) values ('Pod ' || to_char(now(), 'Mon DD')) returning id into v_pod;
  end if;

  insert into pod_members (pod_id, user_id, app_id, seat, status)
  values (v_pod, v_owner, p_app, 'core', 'joined')
  on conflict (pod_id, user_id) do nothing;

  update apps set status = 'queued' where id = p_app;

  select count(*) into v_count from pod_members where pod_id = v_pod;
  return jsonb_build_object('ok', true, 'pod_id', v_pod, 'members', v_count,
                            'seats', (select core_seats from pods where id = v_pod));
end $$;

-- Lock a full pod: build the all-tests-all assignment matrix and start the clock.
create or replace function start_pod(p_pod uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_made int := 0;
begin
  select count(*) into v_n from pod_members where pod_id = p_pod and status <> 'removed';
  if v_n < 6 then return jsonb_build_object('ok', false, 'error', 'not_enough_members'); end if;

  insert into assignments (pod_id, app_id, tester_id, credits_escrowed)
  select p_pod, owner.app_id, tester.user_id, cfg('opt_in_verified')
    from pod_members owner
    join pod_members tester
      on tester.pod_id = owner.pod_id and tester.user_id <> owner.user_id
   where owner.pod_id = p_pod
     and owner.app_id is not null
     and owner.status <> 'removed' and tester.status <> 'removed'
  on conflict (pod_id, app_id, tester_id) do nothing;

  get diagnostics v_made = row_count;

  update pods set status = 'active', locked_at = now(),
         starts_at = now(), ends_at = now() + (duration_days || ' days')::interval
   where id = p_pod;

  update pod_members set status = 'active' where pod_id = p_pod and status = 'joined';
  update apps set status = 'in_pod'
   where id in (select app_id from pod_members where pod_id = p_pod and app_id is not null);

  return jsonb_build_object('ok', true, 'assignments', v_made, 'members', v_n);
end $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_handle text; v_ref text; v_referrer uuid;
begin
  v_handle := lower(regexp_replace(split_part(coalesce(new.email, 'dev'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(v_handle) < 3 then v_handle := 'dev' || v_handle; end if;
  v_handle := left(v_handle, 18) || substr(encode(gen_random_bytes(2),'hex'), 1, 4);

  v_ref := new.raw_user_meta_data->>'referral_code';
  if v_ref is not null then
    select id into v_referrer from profiles where referral_code = v_ref;
  end if;

  insert into profiles (id, handle, display_name, avatar_url, referred_by, tester_email)
  values (new.id, v_handle,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
          new.raw_user_meta_data->>'avatar_url', v_referrer, new.email);

  perform award_credits(new.id, cfg('signup_grant'), 'signup_grant', 'profile', new.id,
                        'Welcome to Cohort');

  if v_referrer is not null then
    insert into referrals (referrer_id, referee_id) values (v_referrer, new.id)
    on conflict do nothing;
    perform award_credits(new.id, cfg('referral_referee'), 'referral_bonus', 'profile', v_referrer);
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Guard: an app owner can never be assigned to test their own app.
create or replace function guard_no_self_test()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from apps where id = new.app_id and owner_id = new.tester_id) then
    raise exception 'a developer cannot test their own app';
  end if;
  return new;
end $$;
create trigger assignments_no_self_test
  before insert or update on assignments
  for each row execute function guard_no_self_test();
