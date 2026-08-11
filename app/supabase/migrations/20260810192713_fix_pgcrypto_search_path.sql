-- pgcrypto is installed into the `extensions` schema on Supabase. Every function
-- pinned to `search_path = public` therefore could not resolve gen_random_bytes(),
-- which would have thrown on the very first real signup. Pin both schemas, and
-- fully qualify the column defaults so they never depend on session search_path.

alter table profiles   alter column referral_code set default encode(extensions.gen_random_bytes(4), 'hex');
alter table pods        alter column code         set default upper(encode(extensions.gen_random_bytes(3), 'hex'));
alter table greenlights alter column slug         set default lower(encode(extensions.gen_random_bytes(5), 'hex'));

alter function handle_new_user()          set search_path = public, extensions;
alter function award_credits(uuid,integer,ledger_reason,text,uuid,text) set search_path = public, extensions;
alter function _pay_tithe(uuid,integer)   set search_path = public, extensions;
alter function spend_credits(uuid,integer,ledger_reason,text,uuid) set search_path = public, extensions;
alter function recompute_reliability(uuid) set search_path = public, extensions;
alter function submit_checkin(uuid,uuid,text) set search_path = public, extensions;
alter function review_feedback(uuid,text,text) set search_path = public, extensions;
alter function arbitrate_dispute(uuid,boolean,text) set search_path = public, extensions;
alter function join_pod(uuid)             set search_path = public, extensions;
alter function start_pod(uuid)            set search_path = public, extensions;
alter function guard_no_self_test()       set search_path = public, extensions;
alter function is_mod()                   set search_path = public, extensions;
alter function cfg(text)                  set search_path = public, extensions;