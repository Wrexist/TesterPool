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

  -- A pod goes only when EVERY member of it is seed data. A seeded pod that a
  -- real developer has since joined is their pod now: deleting it would take
  -- their app, their assignments, their feedback and their ledger rows with it,
  -- which is a far worse outcome than a pod that is briefly short a few seats.
  delete from pods p
   where exists (select 1 from pod_members m where m.pod_id = p.id)
     and not exists (
       select 1 from pod_members m
        where m.pod_id = p.id and not (m.user_id = any(v_ids))
     );

  -- Mixed pods keep their real members and lose only the seeded seats. The
  -- cascade from auth.users would remove these rows anyway; doing it here makes
  -- the ordering explicit and the intent readable.
  delete from pod_members where user_id = any(v_ids);

  delete from auth.identities where user_id = any(v_ids);
  delete from auth.users      where id      = any(v_ids);

  raise notice 'Removed % demo account(s) and the pods they were seeded into.', v_count;
end $$;

-- A demo address must never come back. The check is on profiles rather than
-- auth.users because that is the table this schema owns; a signup carrying one
-- of these addresses fails at profile creation, which fails the signup.
-- NOT VALID: adding a CHECK the normal way takes a lock and scans the table.
-- The constraint still applies to every future insert and update, which is the
-- whole point of it — it just does not re-read history it was created to
-- outlive. The delete above already cleared the only rows that could fail.
alter table profiles drop constraint if exists no_demo_accounts;
alter table profiles add constraint no_demo_accounts
  check (tester_email is null or tester_email::text not ilike '%@demo.testerpool.dev')
  not valid;
