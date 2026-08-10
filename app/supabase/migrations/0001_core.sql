-- ============================================================================
-- COHORT — core schema
-- A compliance-safe peer testing network for indie app developers.
--
-- DESIGN CONSTRAINT (non-negotiable, enforced at the data layer):
-- Credits may only ever attach to CLOSED-TESTING-TRACK activity and to private
-- structured feedback. There is deliberately no table, column, or enum value
-- anywhere in this schema that can represent a public store review, a public
-- store rating, or a production install. This is what keeps the product on the
-- right side of Google Play's "User Ratings, Reviews, and Installs" policy and
-- Apple's review-manipulation rules.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type platform          as enum ('android', 'ios');
create type app_status        as enum ('draft', 'queued', 'in_pod', 'graduated', 'paused', 'rejected');
create type pod_status        as enum ('forming', 'locked', 'active', 'completed', 'failed');
create type seat_type         as enum ('core', 'buffer', 'rescue');
create type membership_status as enum ('invited', 'joined', 'opt_in_pending', 'active', 'dropped', 'graduated', 'removed');
create type proof_kind        as enum ('opt_in', 'daily_use', 'uninstall_release');
create type proof_status      as enum ('pending', 'auto_approved', 'approved', 'rejected', 'escalated');
create type feedback_status   as enum ('draft', 'submitted', 'approved', 'disputed', 'arbitrated', 'rejected');
create type dispute_status    as enum ('open', 'upheld', 'overturned', 'withdrawn');
create type tier              as enum ('bronze', 'silver', 'gold', 'platinum');
create type ledger_reason as enum (
  'signup_grant', 'referral_bonus', 'referral_tithe',
  'opt_in_verified', 'daily_checkin', 'streak_bonus',
  'feedback_approved', 'bug_bounty', 'rescue_bonus', 'arbitration_award',
  'pod_seat_spend', 'buffer_seat_spend', 'rescue_seat_spend', 'priority_spend',
  'expert_seat_spend', 'extra_app_spend',
  'purchase', 'refund', 'admin_adjust', 'penalty_dropout', 'penalty_fraud'
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  handle            citext unique not null check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name      text not null default '',
  avatar_url        text,
  bio               text default '',
  country_code      char(2),
  timezone          text default 'UTC',

  -- The Google account that will be added to closed-testing tracks.
  -- Stored so a creator can add the exact address to their tester email list.
  tester_email      citext,
  tester_email_verified_at timestamptz,

  -- Anti-sybil
  phone_verified_at timestamptz,
  signup_ip_hash    text,
  device_fp_hash    text,

  -- Economy + reputation
  credits           integer not null default 0 check (credits >= 0),
  reliability       numeric(5,2) not null default 70.00 check (reliability between 0 and 100),
  tier              tier not null default 'bronze',
  pods_completed    integer not null default 0,
  pods_dropped      integer not null default 0,
  apps_helped_ship  integer not null default 0,
  current_streak    integer not null default 0,
  longest_streak    integer not null default 0,

  -- Growth
  referral_code     text unique not null default encode(gen_random_bytes(4), 'hex'),
  referred_by       uuid references profiles(id) on delete set null,

  is_moderator      boolean not null default false,
  is_banned         boolean not null default false,
  ban_reason        text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on profiles (reliability desc);
create index on profiles (referred_by);

-- ---------------------------------------------------------------------------
-- apps  (a developer's app that needs testers)
-- ---------------------------------------------------------------------------
create table apps (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  name            text not null,
  platform        platform not null default 'android',
  package_name    text,                    -- com.example.app
  store_url       text,
  icon_url        text,
  tagline         text,
  category        text,
  description     text,

  -- The three things testers actually need. Getting these wrong is the #1
  -- documented cause of failed closed tests, so they are first-class columns
  -- and are validated in the UI before an app can enter a pod.
  opt_in_url      text,                    -- Play closed-track opt-in link
  google_group    citext,                  -- or the group testers must join
  tester_instructions text,

  -- What the creator wants out of the test, shown to testers up front.
  focus_areas     text[] default '{}',
  min_android_version text,

  status          app_status not null default 'draft',
  graduated_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint app_needs_optin_to_queue
    check (status = 'draft' or opt_in_url is not null or google_group is not null)
);
create index on apps (owner_id);
create index on apps (status);
create unique index apps_owner_package_uidx on apps (owner_id, package_name) where package_name is not null;

-- ---------------------------------------------------------------------------
-- pods  (a cohort of developers who test each other for 14 days)
--
-- The pod is the liquidity primitive. It is inherently 1:1 fair — every member
-- tests every other member's app — so it needs no credit inflation to clear.
-- Credits exist only for the edges: buffers, rescues, priority, expert seats.
-- ---------------------------------------------------------------------------
create table pods (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null default upper(encode(gen_random_bytes(3), 'hex')),
  name           text not null default '',
  status         pod_status not null default 'forming',

  -- 12 is Google's requirement. We seat 15 so three people can vanish and the
  -- remaining members still clear the bar. Buffer seats are the whole product.
  core_seats     integer not null default 15 check (core_seats between 5 and 40),
  required_testers integer not null default 12,

  duration_days  integer not null default 14 check (duration_days >= 14),
  category_focus text,
  is_priority    boolean not null default false,   -- paid fast-start pods

  starts_at      timestamptz,
  ends_at        timestamptz,
  locked_at      timestamptz,
  completed_at   timestamptz,

  created_at     timestamptz not null default now()
);
create index on pods (status, starts_at);

-- membership: one row per developer in a pod. Their app is tested by everyone
-- else in the pod, and they test everyone else's app.
create table pod_members (
  id            uuid primary key default gen_random_uuid(),
  pod_id        uuid not null references pods(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  app_id        uuid references apps(id) on delete set null,  -- null = pure tester (rescue/volunteer)
  seat          seat_type not null default 'core',
  status        membership_status not null default 'joined',
  joined_at     timestamptz not null default now(),
  dropped_at    timestamptz,
  drop_reason   text,
  unique (pod_id, user_id)
);
create index on pod_members (user_id, status);
create index on pod_members (pod_id, status);

-- ---------------------------------------------------------------------------
-- assignments  (tester X must test app Y for the pod's duration)
-- ---------------------------------------------------------------------------
create table assignments (
  id              uuid primary key default gen_random_uuid(),
  pod_id          uuid not null references pods(id) on delete cascade,
  app_id          uuid not null references apps(id) on delete cascade,
  tester_id       uuid not null references profiles(id) on delete cascade,

  status          membership_status not null default 'opt_in_pending',
  opt_in_verified_at timestamptz,

  -- Denormalised for the dashboard; kept true by trigger.
  days_checked_in integer not null default 0,
  last_checkin_on date,
  streak_broken   boolean not null default false,

  credits_escrowed integer not null default 0,
  credits_paid     integer not null default 0,

  created_at      timestamptz not null default now(),
  unique (pod_id, app_id, tester_id),
  constraint no_self_testing check (true)  -- enforced in matchmaking fn
);
create index on assignments (tester_id, status);
create index on assignments (app_id, status);

-- ---------------------------------------------------------------------------
-- proofs  (screenshot evidence, AI-triaged then human-moderated)
-- ---------------------------------------------------------------------------
create table proofs (
  id            uuid primary key default gen_random_uuid(),
  uploader_id   uuid not null references profiles(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  kind          proof_kind not null,
  storage_path  text not null,

  -- Vision-model triage. High-confidence passes auto-approve; the rest queue
  -- for a human. Keeps moderation load sublinear as the network grows.
  ai_verdict     jsonb,
  ai_confidence  numeric(4,3),
  perceptual_hash text,            -- catches the same screenshot reused twice

  status        proof_status not null default 'pending',
  reviewed_by   uuid references profiles(id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,

  created_at    timestamptz not null default now()
);
create index on proofs (status, created_at);
create index on proofs (assignment_id, kind);
create index on proofs (perceptual_hash) where perceptual_hash is not null;

-- ---------------------------------------------------------------------------
-- daily check-ins  (the engagement engine)
--
-- Google rejects production applications for LOW ENGAGEMENT, not just missing
-- testers. Competitors deliver opt-ins. We deliver daily opens, evidenced.
-- ---------------------------------------------------------------------------
create table checkins (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  day_number    integer not null check (day_number between 1 and 60),
  checkin_date  date not null,
  proof_id      uuid references proofs(id) on delete set null,
  note          text,
  credits_awarded integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (assignment_id, day_number),
  unique (assignment_id, checkin_date)
);
create index on checkins (assignment_id);

-- ---------------------------------------------------------------------------
-- feedback  (private, structured, arbitrated — never a public store review)
-- ---------------------------------------------------------------------------
create table feedback (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  tester_id     uuid not null references profiles(id) on delete cascade,
  app_id        uuid not null references apps(id) on delete cascade,

  device_model  text,
  os_version    text,

  -- Structured rubric. Scores are PRIVATE to the creator and to moderators and
  -- are never published, exported, or connected to any store surface.
  score_usability   smallint check (score_usability between 1 and 5),
  score_performance smallint check (score_performance between 1 and 5),
  score_clarity     smallint check (score_clarity between 1 and 5),

  first_impression  text,
  what_worked       text,
  what_broke        text,
  repro_steps       text,
  suggestion        text,
  severity          smallint default 0 check (severity between 0 and 3),  -- 3 = crash/blocker

  status        feedback_status not null default 'draft',

  -- The creator marks feedback USEFUL or NOT USEFUL — never AGREEABLE.
  -- creator_verdict cannot be used to withhold credit for critical feedback;
  -- a rejection opens a dispute that a moderator arbitrates. Without this,
  -- creator approval would quietly become a positivity-bias machine.
  creator_verdict   text check (creator_verdict in ('useful','low_effort','off_rubric')),
  creator_note      text,
  reviewed_at       timestamptz,

  credits_awarded integer not null default 0,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (assignment_id)
);
create index on feedback (app_id, status);
create index on feedback (tester_id);

create table disputes (
  id           uuid primary key default gen_random_uuid(),
  feedback_id  uuid not null references feedback(id) on delete cascade,
  raised_by    uuid not null references profiles(id) on delete cascade,
  reason       text not null,
  status       dispute_status not null default 'open',
  resolver_id  uuid references profiles(id) on delete set null,
  resolution   text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on disputes (status, created_at);

-- ---------------------------------------------------------------------------
-- credit ledger  (append-only; profiles.credits is a cached projection)
-- ---------------------------------------------------------------------------
create table credit_ledger (
  id            bigserial primary key,
  user_id       uuid not null references profiles(id) on delete cascade,
  delta         integer not null,
  balance_after integer not null,
  reason        ledger_reason not null,
  ref_type      text,
  ref_id        uuid,
  memo          text,
  created_at    timestamptz not null default now()
);
create index on credit_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- greenlights  (the viral share moment: production access approved)
-- ---------------------------------------------------------------------------
create table greenlights (
  id              uuid primary key default gen_random_uuid(),
  app_id          uuid not null references apps(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  slug            text unique not null default lower(encode(gen_random_bytes(5),'hex')),
  testers_count   integer not null default 0,
  feedback_count  integer not null default 0,
  engagement_pct  integer not null default 0,
  days            integer not null default 14,
  first_try       boolean not null default true,
  is_public       boolean not null default true,
  approved_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index on greenlights (approved_at desc) where is_public;

create table badges (
  key         text primary key,
  label       text not null,
  description text not null,
  icon        text not null default 'star'
);
create table user_badges (
  user_id    uuid references profiles(id) on delete cascade,
  badge_key  text references badges(key) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create table referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references profiles(id) on delete cascade,
  referee_id   uuid not null unique references profiles(id) on delete cascade,
  credits_paid integer not null default 0,
  activated_at timestamptz,
  created_at   timestamptz not null default now()
);
create index on referrals (referrer_id);
