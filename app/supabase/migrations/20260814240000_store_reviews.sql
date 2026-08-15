-- ============================================================================
-- STORE REVIEWS — public-listing installs and published reviews, paid.
--
-- READ THIS BEFORE TOUCHING ANYTHING BELOW.
--
-- Every other migration in this history was built so the schema COULD NOT
-- represent a public store review, a public rating or a production install.
-- That was invariant 1 in CLAUDE.md and it was the product's whole legal
-- argument: a Play policy reviewer could be shown the schema and there was
-- nothing in it to explain away.
--
-- This migration ends that, on the explicit and repeated instruction of the
-- product owner. `feedback.store_rating` is a star rating destined for a store.
-- `feedback.store_review_text` is the body of a public review. Paying for
-- either is an incentivised review under Google Play's Ratings, Reviews and
-- Installs policy and Apple's Guideline 1.2, whatever the review says and
-- however sincerely it is meant — the payment is the violation, not the
-- sentiment. See docs/COMPETITOR-ONTOPRANK.md §3.
--
-- It is therefore built to be switched OFF, and ships off:
--
--   1. `store_reviews` is a feature flag, and it defaults FALSE. Nothing in
--      this migration does anything until somebody turns it on in /admin/flags.
--   2. Every app is opted out. `apps.accepting_store_reviews` defaults false,
--      so a publisher has to ask for this per app, per listing.
--   3. `assignments.kind` records which route a seat came in on, permanently,
--      so the two populations can always be told apart in the ledger, in the
--      evidence pack, and by anyone auditing this later.
--
-- Turning the flag off stops new store activities immediately. It does not
-- retract published reviews, and nothing in this schema can — which is the
-- asymmetry worth understanding before switching it on.
--
-- WHAT THIS DELIBERATELY REUSES rather than duplicates: the install proof is
-- still a proof of kind `opt_in`, so the existing payment path fires unchanged
-- and there is exactly one code path that pays for an install. The review is
-- still a `feedback` row, so the publisher verdict (`review_feedback`) and the
-- moderator arbitration (`arbitrate_dispute`) apply to it without change — and
-- invariant 2 survives: a publisher still cannot silently withhold payment for
-- a review they dislike, because `low_effort` opens a dispute rather than
-- rejecting.
-- ============================================================================

/* ------------------------------------------------------------- 0. the flag */

insert into feature_flags (key, enabled, description)
values (
  'store_reviews',
  false,
  'DEFAULTS OFF. Allows paying for installs from the public store listing and for published store reviews. This is an incentivised review under Google Play and Apple policy; read the header of 20260814240000_store_reviews.sql before enabling.'
)
on conflict (key) do update
  set description = excluded.description,
      updated_at  = now();

/* ------------------------------------------------------- 1. the two routes */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_kind') then
    create type activity_kind as enum ('closed_track', 'store_listing');
  end if;
end $$;

alter table assignments
  add column if not exists kind activity_kind not null default 'closed_track';

comment on column assignments.kind is
  'Which route this seat came in on. closed_track: the tester joined the '
  'developer''s closed testing track and the report is private. store_listing: '
  'the tester installed from the PUBLIC store listing and published a review. '
  'Never inferred — set once by start_activity and never updated.';

create index if not exists assignments_kind_idx on assignments (kind)
  where kind = 'store_listing';

/* --------------------------------------------------- 2. the publisher's opt-in */

alter table apps
  add column if not exists accepting_store_reviews boolean not null default false;

comment on column apps.accepting_store_reviews is
  'The publisher asking, per app, for installs from their public listing and '
  'published store reviews. Defaults false and must stay that way: this is the '
  'consent that makes the whole feature the owner''s decision rather than ours.';

/* ------------------------------------------------------ 3. the review itself */

-- A new proof kind. The INSTALL proof is deliberately still `opt_in`, so the
-- payment path in admin_review_proof and the auto-approve sweep fire unchanged
-- and there stays exactly one place that pays for an install.
alter type proof_kind add value if not exists 'store_review';

alter table feedback
  add column if not exists store_rating smallint,
  add column if not exists store_review_text text,
  add column if not exists store_review_url text,
  add column if not exists store_review_proof_id uuid references proofs(id) on delete set null;

alter table feedback
  drop constraint if exists feedback_store_rating_range;
alter table feedback
  add constraint feedback_store_rating_range
  check (store_rating is null or store_rating between 1 and 5);

comment on column feedback.store_rating is
  'The star rating the tester published on the store. Exists only because the '
  'product owner asked for it; see the header of this migration.';
comment on column feedback.store_review_text is
  'The body of the published store review, kept so the publisher and a '
  'moderator can both read what was posted in their name.';
comment on column feedback.store_review_url is
  'Where the review was published, if the store exposes a deep link.';

/* ------------------------------------------------ 4. keep the two apart */

-- Store columns belong to store seats. Without this a closed-track report could
-- carry a star rating, and the one thing this schema must still be able to say
-- with certainty is which population a row belongs to.
create or replace function guard_store_review_columns()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_kind activity_kind;
begin
  if new.store_rating is null
     and new.store_review_text is null
     and new.store_review_url is null
     and new.store_review_proof_id is null then
    return new;
  end if;

  select a.kind into v_kind from assignments a where a.id = new.assignment_id;

  if v_kind is distinct from 'store_listing' then
    raise exception 'store_fields_on_closed_track'
      using hint = 'A closed-track report cannot carry a store rating or review text.';
  end if;

  return new;
end $$;

revoke execute on function guard_store_review_columns() from anon, authenticated, public;

drop trigger if exists trg_guard_store_review_columns on feedback;
create trigger trg_guard_store_review_columns
  before insert or update on feedback
  for each row execute function guard_store_review_columns();

/* --------------------------------------------- 5. starting a store activity */

-- Same guards as the closed-track version, plus three of its own: the flag,
-- the publisher's per-app consent, and a public listing to install from. The
-- balance check is unchanged and still covers the WHOLE 40 before the seat
-- exists, so a tester never does work the publisher cannot pay for.
create or replace function start_store_activity(p_app uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_app record;
  v_cost integer;
  v_balance integer;
  v_taken integer;
  v_id uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;

  if not coalesce((select enabled from feature_flags where key = 'store_reviews'), false) then
    return jsonb_build_object('ok', false, 'error', 'store_reviews_closed',
      'message', 'Store reviews are switched off.');
  end if;

  if exists (select 1 from profiles where id = v_me and is_banned) then
    raise exception 'account suspended';
  end if;

  select a.id, a.owner_id, a.status, a.platform, a.credits_paused,
         a.accepting_store_reviews, a.activity_target, a.store_url
    into v_app
    from apps a where a.id = p_app for update;

  if v_app.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_app');
  end if;
  if v_app.owner_id = v_me then
    return jsonb_build_object('ok', false, 'error', 'your_own_app');
  end if;
  if not v_app.accepting_store_reviews then
    return jsonb_build_object('ok', false, 'error', 'not_accepting',
      'message', 'This publisher has not opened this app to store reviews.');
  end if;
  if v_app.credits_paused then
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
  end if;

  -- A public listing is the whole premise here. Without one there is nothing to
  -- install from and nothing to review on.
  if v_app.store_url is null then
    return jsonb_build_object('ok', false, 'error', 'no_store_listing',
      'message', 'This app has no public store listing yet.');
  end if;

  if exists (select 1 from assignments where app_id = p_app and tester_id = v_me) then
    return jsonb_build_object('ok', false, 'error', 'already_seated',
      'message', 'You already have a seat on this app.');
  end if;

  -- Bounded exposure, same as the closed-track route.
  select count(*) into v_taken
    from assignments
   where app_id = p_app and status not in ('dropped', 'removed');
  if v_taken >= coalesce(v_app.activity_target, 5) then
    return jsonb_build_object('ok', false, 'error', 'no_seats_left');
  end if;

  v_cost := cfg('install_charge') + cfg('review_charge');
  select credits into v_balance from profiles where id = v_app.owner_id for update;
  if coalesce(v_balance, 0) < v_cost then
    update apps set credits_paused = true where id = p_app;
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits',
      'message', 'This publisher cannot cover the work right now.');
  end if;

  insert into assignments (pod_id, app_id, tester_id, status, kind)
  values (null, p_app, v_me, 'opt_in_pending', 'store_listing')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'assignment_id', v_id, 'kind', 'store_listing');
end $$;

revoke execute on function start_store_activity(uuid) from anon, public;
grant  execute on function start_store_activity(uuid) to authenticated;

/* ------------------------------------------- 6. what the publisher may set */

-- Mirrors set_activity_intake. Separate function on purpose: opting into store
-- reviews is a different decision from opting into closed-track testers, and
-- one switch that did both would let a publisher turn this on without meaning
-- to.
create or replace function set_store_review_intake(p_app uuid, p_accepting boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not your app';
  end if;

  if p_accepting and not coalesce(
      (select enabled from feature_flags where key = 'store_reviews'), false) then
    return jsonb_build_object('ok', false, 'error', 'store_reviews_closed',
      'message', 'Store reviews are switched off for everyone right now.');
  end if;

  update apps set accepting_store_reviews = p_accepting, updated_at = now()
   where id = p_app;

  return jsonb_build_object('ok', true, 'accepting', p_accepting);
end $$;

revoke execute on function set_store_review_intake(uuid, boolean) from anon, public;
grant  execute on function set_store_review_intake(uuid, boolean) to authenticated;

/* -------------------------------------------------- 7. what an admin sees */

-- One row per store activity, with both sides of the review attached: what the
-- tester published, what the publisher decided, and whether a moderator has
-- looked at the screenshot. This is the admin queue's source, and it exists so
-- the answer to "what has been paid for on the public store" is one select
-- rather than a join a person has to remember to write.
create or replace view store_review_audit
with (security_invoker = true) as
select
  f.id                     as feedback_id,
  f.assignment_id,
  f.app_id,
  ap.name                  as app_name,
  ap.store_url,
  ap.owner_id              as publisher_id,
  po.handle                as publisher_handle,
  f.tester_id,
  pt.handle                as tester_handle,
  f.store_rating,
  f.store_review_text,
  f.store_review_url,
  f.status                 as feedback_status,
  f.creator_verdict,
  f.credits_awarded,
  f.submitted_at,
  f.reviewed_at,
  pr.id                    as review_proof_id,
  pr.storage_path          as review_proof_path,
  pr.status                as review_proof_status,
  d.id                     as dispute_id,
  d.status                 as dispute_status
from feedback f
  join assignments a  on a.id = f.assignment_id and a.kind = 'store_listing'
  join apps ap        on ap.id = f.app_id
  left join profiles po on po.id = ap.owner_id
  left join profiles pt on pt.id = f.tester_id
  left join proofs pr on pr.id = f.store_review_proof_id
  left join disputes d on d.feedback_id = f.id;

comment on view store_review_audit is
  'Every paid public-store review, with the publisher verdict, the moderator '
  'state of its screenshot and any dispute. security_invoker, so RLS still '
  'decides who sees which rows — a publisher sees their own, a moderator sees '
  'all of them.';

grant select on store_review_audit to authenticated;
