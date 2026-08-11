-- ============================================================================
-- REMOVING THE DEMO ACCOUNTS
--
-- `/demo` signed you in as any seeded developer with one shared password that
-- is written down in CLAUDE.md. The route is deleted; these are the accounts it
-- signed into, and they are real logins until they are gone.
--
-- Leaving them was never survivable once the economy became a transfer: each
-- one holds a signup grant and can join a pod, so sixteen published-password
-- accounts are sixteen ways to drain a stranger's balance.
--
-- The cascade from auth.users takes profiles, and profiles cascades to apps,
-- pod_members, assignments, feedback, proofs and the ledger. That is the
-- intent — this is seed data, not history worth keeping. It is written to be
-- safe to run on a database that has already been cleaned, and on one that
-- never had the seed in the first place.
--
-- HOW THE SEED IS IDENTIFIED. Two independent marks, and a row needs only one:
-- the @demo.testerpool.dev address on either the auth user or the profile's
-- tester_email. Matching on anything looser risks taking a real account, and a
-- delete against auth.users has no undo.
-- ============================================================================

do $$
declare
  v_ids uuid[];
  v_count int;
begin
  select coalesce(array_agg(distinct id), '{}')
    into v_ids
    from (
      select u.id from auth.users u
       where u.email ilike '%@demo.testerpool.dev'
      union
      select p.id from profiles p
       where p.tester_email::text ilike '%@demo.testerpool.dev'
    ) marked;

  v_count := coalesce(array_length(v_ids, 1), 0);

  if v_count = 0 then
    raise notice 'No demo accounts found. Nothing to remove.';
    return;
  end if;

  -- Any pod left short by this is a seeded pod, and it goes too rather than
  -- being left half-empty for a real developer to wander into.
  delete from pods
   where id in (
     select distinct m.pod_id from pod_members m where m.user_id = any(v_ids)
   );

  delete from auth.identities where user_id = any(v_ids);
  delete from auth.users      where id      = any(v_ids);

  raise notice 'Removed % demo account(s) and the pods they were seeded into.', v_count;
end $$;

-- A demo address must never come back. The check is on profiles rather than
-- auth.users because that is the table this schema owns; a signup carrying one
-- of these addresses fails at profile creation, which fails the signup.
alter table profiles drop constraint if exists no_demo_accounts;
alter table profiles add constraint no_demo_accounts
  check (tester_email is null or tester_email::text not ilike '%@demo.testerpool.dev');
