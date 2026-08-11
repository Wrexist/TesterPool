-- ============================================================================
-- PROOF INTAKE HARDENING
--
-- Screenshot proofs are the only evidence that a tester did the thing they are
-- paid for, and since the economy became a transfer, an approved opt-in proof
-- moves 10 credits out of a developer's balance and into the tester's. That
-- makes the proof path a payment path, and it was not built like one.
--
-- WHAT WAS WRONG
--
-- `recordOptInProof(assignmentId, storagePath, confidence)` took the confidence
-- score FROM THE BROWSER and auto-approved anything at or above 0.85. The score
-- came from a stub in the wizard that guessed from the file's size and name —
-- no model was involved anywhere. Any signed-in user could POST a made-up 0.99
-- and stamp their own opt-in, which now mints credits and charges a stranger.
--
-- Meanwhile `triage-proof`, which does a real vision check with hashing and
-- reuse detection, was never called by anything.
--
-- WHAT THIS DOES
--
-- Moves every decision behind the database. `submit_proof` is the only way to
-- create a proof row: it verifies the assignment is yours, that the storage
-- object exists and sits under your own user-id prefix, that you have not
-- flooded the queue, and it always writes status 'pending'. There is no
-- argument for confidence and no way to reach 'auto_approved' from a client.
--
-- Only `triage-proof` (service role) and a moderator can move a proof out of
-- 'pending'. The vision verdict decides, and if the model is unreachable the
-- proof sits in the human queue — the failure mode is a slow approval, never a
-- free one.
-- ============================================================================

-- --------------------------------------------------------------- the bucket
-- Private. Proofs are screenshots of somebody's phone; several contain their
-- Google account email, which is exactly the field the product tells people to
-- guard. Reads go through short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 8388608,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Every object must live under `<user-id>/…`. Without this an uploader can
-- write into another member's prefix and then submit it as their own proof.
drop policy if exists "proofs upload own prefix" on storage.objects;
create policy "proofs upload own prefix" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "proofs read own" on storage.objects;
create policy "proofs read own" on storage.objects for select to authenticated
  using (
    bucket_id = 'proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or is_mod())
  );

-- No update and no delete for anyone but a moderator. A tester who could
-- overwrite an object could swap the image out from under an approved proof.
drop policy if exists "proofs moderate" on storage.objects;
create policy "proofs moderate" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and is_mod());

-- ------------------------------------------------------------- rate limiting
-- A proof upload costs us a vision call, and an attacker with an unlimited
-- queue costs us money whether or not they ever get approved.
insert into economy_config (key, value, note) values
  ('max_proofs_per_hour', 20, 'Proof submissions per member per hour. Well above honest use; a hard stop on queue flooding.')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- ------------------------------------------------------------- submit_proof
-- The single door into the proofs table.
create or replace function submit_proof(
  p_assignment uuid,
  p_kind       proof_kind,
  p_path       text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := auth.uid();
  v_tester uuid;
  v_recent int;
  v_id uuid;
  v_size bigint;
begin
  if v_user is null then raise exception 'not signed in'; end if;

  -- Yours to prove.
  select tester_id into v_tester from assignments where id = p_assignment;
  if v_tester is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_assignment',
      'message', 'That test does not exist.');
  end if;
  if v_tester <> v_user then
    return jsonb_build_object('ok', false, 'error', 'not_yours',
      'message', 'That is not your test.');
  end if;

  -- The path must sit under the caller's own prefix. The storage policy above
  -- enforces this on write; re-checking here stops a client from submitting a
  -- path it never uploaded — someone else's object, or one that does not exist.
  if p_path is null or p_path !~ ('^' || v_user::text || '/') then
    return jsonb_build_object('ok', false, 'error', 'bad_path',
      'message', 'That upload does not belong to you.');
  end if;

  select (metadata ->> 'size')::bigint into v_size
    from storage.objects where bucket_id = 'proofs' and name = p_path;
  if v_size is null then
    return jsonb_build_object('ok', false, 'error', 'no_object',
      'message', 'The upload did not complete. Try again.');
  end if;

  -- Flood control.
  select count(*) into v_recent from proofs
   where uploader_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= cfg('max_proofs_per_hour') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited',
      'message', 'That is a lot of uploads in one hour. Try again shortly.');
  end if;

  -- The daily install allowance, checked here rather than only at the moment
  -- the opt-in is stamped. The trigger on `assignments` is still the thing that
  -- cannot be bypassed, but meeting a limit *before* uploading a screenshot is
  -- a budget; meeting it afterwards is a bug the tester experiences as theft.
  if p_kind = 'opt_in'
     and not has_unlimited_testing(v_user)
     and _installs_today(v_user) >= cfg('daily_install_cap') then
    return jsonb_build_object('ok', false, 'error', 'daily_cap',
      'message', format(
        'That is your %sth install today. The limit resets at midnight UTC, or Unlimited removes it.',
        cfg('daily_install_cap')));
  end if;

  -- Always 'pending'. The vision pass is the only thing that can raise it, and
  -- it runs as the service role, not as anyone signed in.
  insert into proofs (uploader_id, assignment_id, kind, storage_path, status)
  values (v_user, p_assignment, p_kind, p_path, 'pending')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'proof_id', v_id, 'status', 'pending');
end $$;

revoke execute on function submit_proof(uuid, proof_kind, text) from anon, public;
grant  execute on function submit_proof(uuid, proof_kind, text) to authenticated;

-- --------------------------------------------------- lock the table down
-- Direct writes are what `submit_proof` exists to replace. PostgREST exposes
-- `proofs` like every other table, so the grant is the thing that actually
-- stops a client inserting `status: 'auto_approved'` by hand.
revoke insert, update, delete on proofs from anon, authenticated;

drop policy if exists "proofs insert own" on proofs;
drop policy if exists "proofs update own" on proofs;

-- Belt and braces: even holding the service role, a proof may only be created
-- in a state that has not been judged yet.
create or replace function guard_proof_insert()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.status <> 'pending' then
    raise exception 'a proof is created pending and judged afterwards, never both at once';
  end if;
  if new.ai_confidence is not null then
    raise exception 'ai_confidence is written by triage, not by the submitter';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_proof_insert on proofs;
create trigger trg_guard_proof_insert
  before insert on proofs
  for each row execute function guard_proof_insert();

-- ------------------------------------------------------- the triage backlog
-- Anything the inline call missed: the Server Action fires triage immediately
-- after submit_proof, but a cold start, a timeout or a deploy mid-request would
-- leave a proof sitting unjudged. This is what the sweep picks up, and it is
-- also the reason the inline call is allowed to fail quietly.
create or replace function proofs_awaiting_triage(p_limit int default 20)
returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select id from proofs
   where status = 'pending'
     and (ai_verdict is null or ai_verdict ->> 'triage' in ('failed', 'unconfigured'))
     and created_at < now() - interval '2 minutes'
   order by created_at
   limit greatest(1, least(p_limit, 100))
$$;

revoke execute on function proofs_awaiting_triage(int) from anon, authenticated, public;
grant  execute on function proofs_awaiting_triage(int) to service_role;

-- ------------------------------------------------- stamping approved opt-ins
-- An approved opt-in proof is what starts a tester's fourteen days, and
-- stamping it is what moves the credits. Three things can approve one — the
-- vision pass, a moderator, and the backlog sweep — and all three can meet a
-- tester who is already at their daily allowance.
--
-- Rather than let the cap trigger abort whichever of them got there first, the
-- stamp is done row by row and a capped row is simply left alone. It is still
-- approved, and tomorrow's run picks it up. Nobody loses the credit; they wait
-- for it, which is what a daily allowance means.
create or replace function stamp_approved_optins(p_limit int default 200)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_stamped int := 0;
  v_deferred int := 0;
begin
  for r in
    select a.id
      from proofs p
      join assignments a on a.id = p.assignment_id
     where p.kind = 'opt_in'
       and p.status in ('auto_approved', 'approved')
       and a.opt_in_verified_at is null
     order by p.created_at
     limit greatest(1, least(p_limit, 1000))
  loop
    begin
      update assignments
         set opt_in_verified_at = now(),
             status = case when status = 'opt_in_pending' then 'active' else status end
       where id = r.id and opt_in_verified_at is null;
      v_stamped := v_stamped + 1;
    exception when others then
      -- The daily cap, almost always. Left for the next run.
      v_deferred := v_deferred + 1;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'stamped', v_stamped, 'deferred', v_deferred);
end $$;

revoke execute on function stamp_approved_optins(int) from anon, authenticated, public;
grant  execute on function stamp_approved_optins(int) to service_role;

-- A moderator approving a proof must not see a raw trigger exception because
-- the tester happens to be at their allowance. Same rule: approve the proof,
-- defer the stamp.
create or replace function admin_review_proof(p_proof uuid, p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_assignment uuid; v_kind proof_kind; v_deferred boolean := false;
begin
  perform _require_admin();
  select assignment_id, kind into v_assignment, v_kind from proofs where id = p_proof;
  if not found then raise exception 'no such proof'; end if;

  update proofs set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(),
         reject_reason = case when p_approve then null else p_reason end
   where id = p_proof;

  if p_approve and v_kind = 'opt_in' and v_assignment is not null then
    begin
      update assignments set opt_in_verified_at = coalesce(opt_in_verified_at, now()),
             status = 'active' where id = v_assignment;
    exception when others then
      v_deferred := true;
    end;
  end if;

  perform _audit(case when p_approve then 'proof_approve' else 'proof_reject' end,
                 'proof', p_proof, null, null, p_reason);
  return jsonb_build_object('ok', true, 'approved', p_approve, 'stamp_deferred', v_deferred,
    'message', case when v_deferred
      then 'Approved. The tester is at their daily allowance, so the credit lands on the next sweep.'
      else null end);
end $$;

revoke execute on function admin_review_proof(uuid, boolean, text) from anon, public;
grant  execute on function admin_review_proof(uuid, boolean, text) to authenticated;

-- ------------------------------------------------------------ moderator view
-- What a human needs to judge a proof without clicking into four tables. The
-- image itself is fetched with a signed URL; everything else is here.
create or replace view proof_queue with (security_invoker = on) as
select
  p.id,
  p.kind,
  p.status,
  p.storage_path,
  p.ai_confidence,
  p.ai_verdict,
  p.perceptual_hash,
  p.created_at,
  p.uploader_id,
  up.handle          as uploader_handle,
  up.reliability     as uploader_reliability,
  a.id               as assignment_id,
  ap.name            as app_name,
  ap.package_name,
  (p.ai_verdict -> 'duplicate_of') as duplicate_of,
  (select count(*) from proofs older
    where older.uploader_id = p.uploader_id and older.status = 'rejected') as uploader_rejections
from proofs p
join profiles up on up.id = p.uploader_id
left join assignments a on a.id = p.assignment_id
left join apps ap on ap.id = a.app_id;

grant select on proof_queue to authenticated;
