\set ON_ERROR_STOP on
-- A fresh tester with no history, walked up to and past the install cap.
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'capper@test.dev');
insert into profiles (id, handle, display_name) values
  ('44444444-4444-4444-4444-444444444444', 'capper', 'Capper')
on conflict (id) do update set handle = excluded.handle;

do $$
declare i int; v_a uuid; v_pod uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
begin
  for i in 1..10 loop
    v_a := gen_random_uuid();
    insert into apps (id, owner_id, name, opt_in_url)
    values (v_a, '11111111-1111-1111-1111-111111111111', 'Cap ' || i,
            'https://play.google.com/apps/testing/com.cap' || i);
    insert into assignments (id, pod_id, app_id, tester_id)
    values (v_a, v_pod, v_a, '44444444-4444-4444-4444-444444444444');
    update assignments set opt_in_verified_at = now(), status = 'active' where id = v_a;
  end loop;
end $$;

select assert_eq(_installs_today('44444444-4444-4444-4444-444444444444'), 10,
                 'ten installs banked today');

do $$
declare v_a uuid := gen_random_uuid(); v_failed boolean := false;
begin
  insert into apps (id, owner_id, name, opt_in_url)
  values (v_a, '11111111-1111-1111-1111-111111111111', 'Cap 11',
          'https://play.google.com/apps/testing/com.cap11');
  insert into assignments (id, pod_id, app_id, tester_id)
  values (v_a, 'bbbbbbbb-0000-0000-0000-000000000001', v_a,
          '44444444-4444-4444-4444-444444444444');
  begin
    update assignments set opt_in_verified_at = now(), status = 'active' where id = v_a;
  exception when others then
    v_failed := true;
    if sqlerrm not like '%daily_install_cap%' then
      raise exception 'FAIL blocked for the wrong reason: %', sqlerrm;
    end if;
  end;
  if not v_failed then raise exception 'FAIL the 11th install was allowed through'; end if;
  raise notice 'PASS the 11th install is refused';

  -- ...and the pass lifts it.
  insert into entitlements (user_id, kind, expires_at)
  values ('44444444-4444-4444-4444-444444444444', 'unlimited', now() + interval '30 days');
  update assignments set opt_in_verified_at = now(), status = 'active' where id = v_a;
  raise notice 'PASS the pass lifts the install cap';
end $$;

select assert_eq(_installs_today('44444444-4444-4444-4444-444444444444'), 11,
                 'the 11th install lands once the pass is held');
\echo '========= INSTALL CAP TESTS PASSED ========='
