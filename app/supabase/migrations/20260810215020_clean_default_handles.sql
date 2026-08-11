-- First impressions: the old generator always appended four random hex
-- characters, so a brand-new user's first sight of their own identity was
-- "@firstrun01ccba". Take the clean handle when it is free, and only
-- disambiguate when it is not — and then with a readable number, not hex.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_base text; v_handle text; v_n int := 1;
  v_ref text; v_referrer uuid;
begin
  v_base := lower(regexp_replace(split_part(coalesce(new.email, 'dev'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(v_base) < 3 then v_base := 'dev' || v_base; end if;
  v_base := left(v_base, 20);

  v_handle := v_base;
  while exists (select 1 from profiles where handle = v_handle) loop
    v_n := v_n + 1;
    v_handle := left(v_base, 20 - length(v_n::text)) || v_n::text;
    if v_n > 9999 then
      v_handle := v_base || substr(encode(extensions.gen_random_bytes(2), 'hex'), 1, 4);
      exit;
    end if;
  end loop;

  v_ref := new.raw_user_meta_data->>'referral_code';
  if v_ref is not null then select id into v_referrer from profiles where referral_code = v_ref; end if;

  insert into profiles (id, handle, display_name, avatar_url, referred_by, tester_email)
  values (new.id, v_handle,
          coalesce(new.raw_user_meta_data->>'full_name',
                   nullif(new.raw_user_meta_data->>'name', ''),
                   split_part(coalesce(new.email,''), '@', 1)),
          new.raw_user_meta_data->>'avatar_url', v_referrer,
          -- Only prefill the Play tester address when the login address could
          -- plausibly be a Google account. GitHub noreply and Apple private
          -- relay addresses can never accept a closed-testing opt-in.
          case when new.email ~* '@(gmail\.com|googlemail\.com)$' then new.email::extensions.citext end);

  perform award_credits(new.id, cfg('signup_grant'), 'signup_grant', 'profile', new.id,
                        'Welcome to TesterPool');

  if v_referrer is not null then
    insert into referrals (referrer_id, referee_id) values (v_referrer, new.id) on conflict do nothing;
    perform award_credits(new.id, cfg('referral_referee'), 'referral_bonus', 'profile', v_referrer);
  end if;
  return new;
end $$;

-- Tidy the handles that the old generator already mangled for demo accounts.
update profiles set handle = 'firstrun01' where handle = 'firstrun01ccba';

select handle, tester_email from profiles where handle = 'firstrun01';
