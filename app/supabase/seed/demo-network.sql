-- ============================================================================
-- DEMO NETWORK.
--
-- A populated feed, so the product can be walked through end to end instead of
-- being read about. Everything here is fictional: eight developers, forty
-- listings across both stores, and enough recent work to make the 24H strip a
-- measurement rather than three zeroes.
--
-- Two things this deliberately does NOT do.
--
-- It does not mint credits. Every balance below is written through
-- `award_credits`, which appends to `credit_ledger` in the same statement, so
-- the demo network reconciles exactly like the real one and `ledger_drift()`
-- stays at zero. A demo that quietly set `profiles.credits` would be the first
-- thing to make the ledger lie.
--
-- It does not create a way to sign in. These profiles have `auth.users` rows
-- because `profiles.id` references them, but no password and no identity row,
-- so none of them is a login. The demo is browsed as yourself.
--
-- Re-runnable: every insert is keyed on a fixed id and does nothing on
-- conflict, and the activity at the bottom is only generated when it is absent.
-- ============================================================================

/* --------------------------------------------------------------- the people */

-- Built column by column at run time rather than written out, because this file
-- has to apply to two different shapes of `auth.users`: the real one on
-- Supabase, and the deliberately thin stub the migration tests replay against.
-- A fixed column list fails on whichever of the two it was not written for.
--
-- Where the token columns DO exist they are set to empty strings rather than
-- left NULL. GoTrue scans them into Go strings, and a NULL there produces
-- "Database error querying schema" at sign-in. None of these rows is a login --
-- there is no password and no `auth.identities` row -- but a NULL left in the
-- table is a trap for whatever gets added next to it.
do $seed$
declare
  v_cols text := 'id, email';
  v_vals text := 'v.id, v.email';
  c      text;
begin
  foreach c in array array[
    'instance_id','aud','role','email_confirmed_at','created_at','updated_at',
    'raw_app_meta_data','raw_user_meta_data'
  ] loop
    if exists (select 1 from information_schema.columns
                where table_schema='auth' and table_name='users' and column_name=c) then
      v_cols := v_cols || ', ' || c;
      v_vals := v_vals || ', ' || case c
        when 'instance_id'        then quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid'
        when 'aud'                then quote_literal('authenticated')
        when 'role'               then quote_literal('authenticated')
        when 'email_confirmed_at' then 'now()'
        when 'created_at'         then 'now() - (v.age * interval ''1 day'')'
        when 'updated_at'         then 'now()'
        when 'raw_app_meta_data'  then quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
        else quote_literal('{}') || '::jsonb' end;
    end if;
  end loop;

  foreach c in array array[
    'confirmation_token','recovery_token','email_change','email_change_token_new',
    'email_change_token_current','phone_change','phone_change_token','reauthentication_token'
  ] loop
    if exists (select 1 from information_schema.columns
                where table_schema='auth' and table_name='users' and column_name=c) then
      v_cols := v_cols || ', ' || c;
      v_vals := v_vals || ', ' || quote_literal('');
    end if;
  end loop;

  execute format(
    'insert into auth.users (%s) select %s from (values '
    '(''d0000000-0000-4000-a000-000000000001''::uuid, ''benjamin@demo.invalid'',  120),'
    '(''d0000000-0000-4000-a000-000000000002''::uuid, ''jetzt@demo.invalid'',      96),'
    '(''d0000000-0000-4000-a000-000000000003''::uuid, ''gabriel@demo.invalid'',    88),'
    '(''d0000000-0000-4000-a000-000000000004''::uuid, ''pawlit@demo.invalid'',     74),'
    '(''d0000000-0000-4000-a000-000000000005''::uuid, ''truenorth@demo.invalid'',  61),'
    '(''d0000000-0000-4000-a000-000000000006''::uuid, ''aiko@demo.invalid'',       47),'
    '(''d0000000-0000-4000-a000-000000000007''::uuid, ''mirembe@demo.invalid'',    33),'
    '(''d0000000-0000-4000-a000-000000000008''::uuid, ''sandoval@demo.invalid'',   19)'
    ') as v(id, email, age) on conflict (id) do nothing',
    v_cols, v_vals);
end $seed$;

insert into profiles (id, handle, display_name, country_code, tester_email, reliability, pods_completed, apps_helped_ship, last_seen_at)
select v.id, v.handle, v.display_name, v.country, v.email, v.reliability, v.jobs, v.shipped,
       now() - (v.seen_mins || ' minutes')::interval
from (values
  ('d0000000-0000-4000-a000-000000000001'::uuid, 'benjaminb', 'Benjamin Tobias Blankenhorn', 'DE', 'benjamin@demo.invalid',  96, 41, 7,    9),
  ('d0000000-0000-4000-a000-000000000002'::uuid, 'jetzt',     'Jetzt & Dahanna Technologies', 'NG', 'jetzt@demo.invalid',     88, 26, 4,   34),
  ('d0000000-0000-4000-a000-000000000003'::uuid, 'gabrielh',  'Gabriel Hohener',              'CH', 'gabriel@demo.invalid',   92, 33, 5,  120),
  ('d0000000-0000-4000-a000-000000000004'::uuid, 'pawlitlabs','Pawlit Labs',                  'PL', 'pawlit@demo.invalid',    99, 58, 9,    3),
  ('d0000000-0000-4000-a000-000000000005'::uuid, 'truenorth', 'True North Originals LLC',     'US', 'truenorth@demo.invalid', 84, 19, 3,  480),
  ('d0000000-0000-4000-a000-000000000006'::uuid, 'aikom',     'Aiko Matsumoto',               'JP', 'aiko@demo.invalid',      94, 37, 6,   17),
  ('d0000000-0000-4000-a000-000000000007'::uuid, 'mirembe',   'Mirembe Nakato',               'UG', 'mirembe@demo.invalid',   90, 22, 4,   62),
  ('d0000000-0000-4000-a000-000000000008'::uuid, 'sandoval',  'Sandoval Interactive',         'MX', 'sandoval@demo.invalid',  87, 15, 2, 1440)
) as v(id, handle, display_name, country, email, reliability, jobs, shipped, seen_mins)
on conflict (id) do nothing;

/* -------------------------------------------------------------- the balances */

-- Through award_credits, never by writing profiles.credits. A publisher needs
-- 40 in hand per seat they are offering, and these targets are set below.
do $$
declare r record;
begin
  for r in select id from profiles where id::text like 'd0000000-0000-4000-a000-%' loop
    if coalesce((select credits from profiles where id = r.id), 0) < 600 then
      perform award_credits(r.id, 1200, 'admin_adjust'::ledger_reason,
                            'demo_seed', null,
                            'Opening balance for the demo network');
    end if;
  end loop;
end $$;

/* -------------------------------------------------------------- the listings */

-- `opt_in_url` is set on every row because `app_needs_optin_to_queue` requires
-- one on anything that is not a draft. On iOS that is the TestFlight invite,
-- which is genuinely the route in; on Android it is the closed-track link.
insert into apps (
  id, owner_id, name, platform, status, package_name, store_url, opt_in_url,
  tagline, category, description, focus_areas,
  accepting_activities, activity_target, accepting_store_reviews, featured, created_at
)
select
  v.id, v.owner, v.name, v.platform::platform, v.status::app_status,
  v.package, v.store_url, v.opt_in,
  v.tagline, v.category, v.description, v.focus,
  true, 12, true, v.featured, now() - (v.age || ' hours')::interval
from (values
  ('e0000000-0000-4000-a000-000000000001'::uuid,'d0000000-0000-4000-a000-000000000001'::uuid,'Sudøku','ios','in_pod','com.blankenhorn.sudoku','https://apps.apple.com/app/id1000000001','https://testflight.apple.com/join/demo0001','Enjoy Sudoku the way it should be played-fast, intuitive and completely offline.','Games','Enjoy Sudoku the way it should be played-fast, intuitive and completely offline.

Solve unlimited Sudoku puzzles generated directly on your device. Four difficulty levels, a clean board that stays readable one-handed, and no account, no advertising and no network call at any point.

Pencil marks, mistake highlighting and an undo history that goes back as far as you need. Your streak and solve times are kept on the device.',array['First-run clarity','Board readability one-handed','Difficulty curve'],false, 6),
  ('e0000000-0000-4000-a000-000000000002'::uuid,'d0000000-0000-4000-a000-000000000002'::uuid,'sudøku – Sudoku Offline','android','in_pod','com.jetzt.sudokuoffline','https://play.google.com/store/apps/details?id=com.jetzt.sudokuoffline','https://play.google.com/apps/testing/com.jetzt.sudokuoffline','Offline Sudoku with a daily challenge and no advertising.','Game Puzzle','Offline Sudoku with a daily challenge and no advertising.

Built for slow connections and older devices: the whole app is under 8MB and every puzzle is generated locally. A daily challenge, five difficulties and a statistics screen that tracks solve time by difficulty.',array['Install size on older devices','Daily challenge discovery'],false, 11),
  ('e0000000-0000-4000-a000-000000000003'::uuid,'d0000000-0000-4000-a000-000000000003'::uuid,'Meadow Mahjong Solitaire','ios','in_pod','com.hohener.meadowmahjong','https://apps.apple.com/app/id1000000003','https://testflight.apple.com/join/demo0003','Hand-drawn mahjong solitaire with three hundred layouts.','Games','Hand-drawn mahjong solitaire with three hundred layouts.

Every tile is illustrated by hand and every layout is solvable — no shuffling out of a dead board. Play at your own pace with unlimited undo, or take the timed daily.',array['Tile contrast','Layout difficulty labels'],false, 19),
  ('e0000000-0000-4000-a000-000000000004'::uuid,'d0000000-0000-4000-a000-000000000004'::uuid,'Knotwork: Color Lines','android','in_pod','com.pawlit.knotwork','https://play.google.com/store/apps/details?id=com.pawlit.knotwork','https://play.google.com/apps/testing/com.pawlit.knotwork','Untangle coloured lines into celtic knots. 400 handmade levels.','Game Puzzle','Untangle coloured lines into celtic knots. 400 handmade levels.

A quiet puzzle game about pulling threads apart until nothing crosses. Levels are handmade rather than generated, so difficulty rises the way a book does.',array['Colour-blind palette','Level 1-10 difficulty ramp','Hint pacing'],true, 26),
  ('e0000000-0000-4000-a000-000000000005'::uuid,'d0000000-0000-4000-a000-000000000005'::uuid,'MyWins: Chore Chart for ADHD','ios','in_pod','com.truenorth.mywins','https://apps.apple.com/app/id1000000005','https://testflight.apple.com/join/demo0005','A chore chart built around finishing, not remembering.','Productivity','A chore chart built around finishing, not remembering.

Made with and for people with ADHD. One task on screen at a time, a two-minute starter timer, and a win log you can scroll back through on the days it does not feel like anything got done.',array['One-task-at-a-time flow','Timer discoverability','Win log tone'],false, 31),
  ('e0000000-0000-4000-a000-000000000006'::uuid,'d0000000-0000-4000-a000-000000000006'::uuid,'Kanso Habit','ios','in_pod','com.matsumoto.kanso','https://apps.apple.com/app/id1000000006','https://testflight.apple.com/join/demo0006','Habit tracking with one screen and no streak guilt.','Productivity','Habit tracking with one screen and no streak guilt.

Missing a day does not reset anything. The chart shows density over a year rather than an unbroken run, because the point is the trend.',array['Density chart legibility','Onboarding without an account'],false, 38),
  ('e0000000-0000-4000-a000-000000000007'::uuid,'d0000000-0000-4000-a000-000000000007'::uuid,'Boda Fare','android','in_pod','com.nakato.bodafare','https://play.google.com/store/apps/details?id=com.nakato.bodafare','https://play.google.com/apps/testing/com.nakato.bodafare','Agree the fare before you get on. Works with no signal.','Maps & Navigation','Agree the fare before you get on. Works with no signal.

Fare estimates for boda routes in Kampala, cached on the device so they work in a dead zone. Add your own routes and the app learns what you actually pay.',array['Offline behaviour','Route entry on a small screen'],false, 44),
  ('e0000000-0000-4000-a000-000000000008'::uuid,'d0000000-0000-4000-a000-000000000008'::uuid,'Tienda Ledger','android','in_pod','com.sandoval.tiendaledger','https://play.google.com/store/apps/details?id=com.sandoval.tiendaledger','https://play.google.com/apps/testing/com.sandoval.tiendaledger','Daily books for a corner shop, in under a minute.','Business','Daily books for a corner shop, in under a minute.

Cash in, cash out, and what is owed. Designed to be filled in standing up, with big targets and no menus deeper than one level.',array['Speed of daily entry','Number pad ergonomics'],false, 52),
  ('e0000000-0000-4000-a000-000000000009'::uuid,'d0000000-0000-4000-a000-000000000001'::uuid,'Tidepool Timer','ios','in_pod','com.blankenhorn.tidepool','https://apps.apple.com/app/id1000000009','https://testflight.apple.com/join/demo0009','A pomodoro timer that sounds like the sea.','Productivity','A pomodoro timer that sounds like the sea.

Twenty-five minutes of tide, five minutes of gulls. No accounts, no statistics dashboard, no streaks to protect — start it and it runs.',array['Sound levels','Background playback'],false, 58),
  ('e0000000-0000-4000-a000-000000000010'::uuid,'d0000000-0000-4000-a000-000000000004'::uuid,'Runegrid','android','in_pod','com.pawlit.runegrid','https://play.google.com/store/apps/details?id=com.pawlit.runegrid','https://play.google.com/apps/testing/com.pawlit.runegrid','A word game on a hex grid, in eleven languages.','Word','A word game on a hex grid, in eleven languages.

Find words along any of six directions. Dictionaries are downloaded once and then work offline, and the daily board is the same for everybody.',array['Dictionary download flow','Hex grid touch accuracy'],true, 65),
  ('e0000000-0000-4000-a000-000000000011'::uuid,'d0000000-0000-4000-a000-000000000006'::uuid,'Shodo Notes','ios','in_pod','com.matsumoto.shodo','https://apps.apple.com/app/id1000000011','https://testflight.apple.com/join/demo0011','Handwriting notes that stay handwriting.','Productivity','Handwriting notes that stay handwriting.

No conversion to text, no cloud. Ink, paper textures, and a search that works on the strokes themselves.',array['Ink latency','Search accuracy'],false, 71),
  ('e0000000-0000-4000-a000-000000000012'::uuid,'d0000000-0000-4000-a000-000000000007'::uuid,'Matatu Route','android','in_pod','com.nakato.matatu','https://play.google.com/store/apps/details?id=com.nakato.matatu','https://play.google.com/apps/testing/com.nakato.matatu','Crowd-mapped minibus routes for Kampala.','Maps & Navigation','Crowd-mapped minibus routes for Kampala.

Routes drawn by the people who ride them. Works offline once a city is downloaded, and corrections go up when you next have signal.',array['Offline map size','Correction flow'],false, 78),
  ('e0000000-0000-4000-a000-000000000013'::uuid,'d0000000-0000-4000-a000-000000000003'::uuid,'Alpine Ledger','ios','in_pod','com.hohener.alpineledger','https://apps.apple.com/app/id1000000013','https://testflight.apple.com/join/demo0013','Split costs on a trip without an account.','Finance','Split costs on a trip without an account.

Everyone scans one code and the group is made. No sign-up, no server-side history, and a settle-up screen that produces the fewest possible transfers.',array['Group join by code','Settle-up maths clarity'],false, 85),
  ('e0000000-0000-4000-a000-000000000014'::uuid,'d0000000-0000-4000-a000-000000000002'::uuid,'Naija Recipes Offline','android','in_pod','com.jetzt.naijarecipes','https://play.google.com/store/apps/details?id=com.jetzt.naijarecipes','https://play.google.com/apps/testing/com.jetzt.naijarecipes','Four hundred recipes, no connection needed.','Food & Drink','Four hundred recipes, no connection needed.

Written in plain measures rather than grams, with a shopping list that groups by where things sit in the market.',array['Search in a second language','Shopping list grouping'],false, 92),
  ('e0000000-0000-4000-a000-000000000015'::uuid,'d0000000-0000-4000-a000-000000000005'::uuid,'Quiet Hours','ios','in_pod','com.truenorth.quiethours','https://apps.apple.com/app/id1000000015','https://testflight.apple.com/join/demo0015','Block the apps you keep opening without deciding to.','Productivity','Block the apps you keep opening without deciding to.

A delay screen rather than a hard block: it asks what you came for, and most of the time that is enough.',array['Delay screen wording','Setup on first run'],false, 99),
  ('e0000000-0000-4000-a000-000000000016'::uuid,'d0000000-0000-4000-a000-000000000008'::uuid,'Lotería Night','android','in_pod','com.sandoval.loteria','https://play.google.com/store/apps/details?id=com.sandoval.loteria','https://play.google.com/apps/testing/com.sandoval.loteria','Host lotería for a room, from one phone.','Games','Host lotería for a room, from one phone.

One device calls, everyone else plays on paper. Adjustable calling speed and a voice that can be turned off for a noisy room.',array['Calling speed range','Legibility across a table'],false,106)
) as v(id, owner, name, platform, status, package, store_url, opt_in, tagline, category, description, focus, featured, age)
on conflict (id) do nothing;

/* ------------------------------------------------------------- recent work */

-- What makes the 24H strip a measurement. Testers are the demo developers
-- working on each other's listings, which is exactly how the exchange is meant
-- to run: everybody both publishes and tests.
--
-- Guarded on absence rather than on conflict, because the seat, its proof, its
-- payment and its report are four rows that only make sense together.
do $$
declare
  v_app     record;
  v_tester  uuid;
  v_seat    uuid;
  v_offset  int := 0;
begin
  if exists (select 1 from assignments a
              join apps p on p.id = a.app_id
             where p.id::text like 'e0000000-0000-4000-a000-%') then
    raise notice 'demo activity already present, skipping';
    return;
  end if;

  for v_app in
    select id, owner_id from apps
     where id::text like 'e0000000-0000-4000-a000-%'
     order by id
  loop
    -- Three seats per listing, taken by developers who do not own it.
    for v_tester in
      select id from profiles
       where id::text like 'd0000000-0000-4000-a000-%'
         and id <> v_app.owner_id
       order by md5(id::text || v_app.id::text)
       limit 3
    loop
      v_offset := v_offset + 1;

      insert into assignments (app_id, tester_id, pod_id, created_at)
      values (v_app.id, v_tester, null, now() - (v_offset * 47 || ' minutes')::interval)
      returning id into v_seat;

      -- The install, paid the same 10 the real path pays. Stamping
      -- opt_in_verified_at is what fires the transfer trigger, so this moves
      -- credits from the publisher rather than conjuring them.
      update assignments
         set opt_in_verified_at = now() - (v_offset * 41 || ' minutes')::interval
       where id = v_seat;

      -- Two seats in three also filed their report, on the real rubric rather
      -- than a free-text blob: the scores and the three prose fields are what
      -- `review_feedback` and the dispute path actually read.
      if v_offset % 3 <> 0 then
        insert into feedback (
          assignment_id, tester_id, app_id,
          device_model, os_version,
          score_usability, score_performance, score_clarity,
          first_impression, what_worked, what_broke, repro_steps, suggestion,
          severity, status, submitted_at, created_at, reviewed_at
        )
        values (
          v_seat, v_tester, v_app.id,
          (array['Pixel 6a','Redmi Note 11','iPhone 12 mini','Galaxy A54','iPhone SE 2022'])[1 + (v_offset % 5)],
          (array['Android 14','Android 13','iOS 17.4','Android 14','iOS 16.7'])[1 + (v_offset % 5)],
          3 + (v_offset % 3), 4 + (v_offset % 2), 3 + (v_offset % 3),
          (array[
            'Understood what it was for before the first screen finished loading, which is rarer than it should be.',
            'Took me two tries to work out where to start. The empty state names a feature rather than an action.',
            'Opened straight into something usable with no account wall, so I was three taps in before I thought about it.'
          ])[1 + (v_offset % 3)],
          (array[
            'Cold start is well under a second on a four-year-old device. The board stays readable one-handed at the largest system font size.',
            'Offline behaviour is genuinely offline -- I put the phone in flight mode for the whole session and nothing degraded.',
            'Undo history goes back far enough to be worth trusting, which changes how willing I am to experiment.'
          ])[1 + (v_offset % 3)],
          (array[
            'The notification permission is asked for before anything has happened, so the honest answer at that point is no.',
            'Crash on rotate while the first screen is still drawing.',
            'Nothing broke. The only friction was finding the settings screen, which is behind an icon I read as profile.'
          ])[1 + (v_offset % 3)],
          (array[
            'Fresh install, tap through onboarding, and the prompt appears on the second screen before any content.',
            'Open cold, start a session, rotate to landscape while it is still loading. About one time in three.',
            null
          ])[1 + (v_offset % 3)],
          (array[
            'Ask after the first completed session instead. The answer changes once the app has earned it.',
            'Hold the orientation until the first draw finishes, or keep the last frame while it re-lays out.',
            'A label under the settings icon, or move it into the header where people look first.'
          ])[1 + (v_offset % 3)],
          (array[1, 2, 0])[1 + (v_offset % 3)],
          'approved'::feedback_status,
          now() - (v_offset * 37 * interval '1 minute'),
          now() - (v_offset * 37 * interval '1 minute'),
          -- The pulse counts an approved report by when it was REVIEWED, not
          -- when it was filed, so leaving this null showed 32 reports as zero.
          now() - (v_offset * 31 * interval '1 minute')
        );
      end if;
    end loop;
  end loop;
end $$;

/* ------------------------------------------------- the account being demoed */

-- Enough balance to take work and to pay for a seat on the listing it owns.
-- Through award_credits for the reason at the top of this file.
do $$
declare v_me uuid;
begin
  select id into v_me from auth.users where lower(email) = 'isacmolin@gmail.com';
  if v_me is null then
    raise notice 'demo account not found on this database, skipping its balance';
    return;
  end if;
  if coalesce((select credits from profiles where id = v_me), 0) < 400 then
    perform award_credits(v_me, 800, 'admin_adjust'::ledger_reason,
                          'demo_seed', null,
                          'Opening balance for the demo');
  end if;
end $$;
