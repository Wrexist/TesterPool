-- Minimum Supabase surface the migrations expect, so the real files can be
-- replayed unmodified against a stock Postgres.
create role anon;
create role authenticated;
create role service_role;
create role supabase_auth_admin;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists graphql_public;

create extension if not exists pgcrypto  with schema extensions;
create extension if not exists citext     with schema extensions;
create extension if not exists pg_trgm    with schema extensions;

-- Supabase puts gen_random_uuid in the search path everywhere.
create or replace function public.gen_random_uuid() returns uuid
  language sql volatile as $$ select extensions.gen_random_uuid() $$;

create table auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table auth.identities (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text,
  provider_id text,
  identity_data jsonb default '{}'::jsonb
);

-- The signed-in user. Overridden per-test with set_config.
create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable as $$ select 'authenticated'::text $$;

create or replace function auth.jwt() returns jsonb
  language sql stable as $$ select '{}'::jsonb $$;

-- Storage bucket/object stubs: the migrations create policies against these.
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);
alter table storage.objects enable row level security;

-- pg_cron / pg_net are scheduled-job extensions the jobs migration calls into.
create schema if not exists cron;
create table cron.job (
  jobid bigserial primary key, schedule text, command text,
  jobname text, active boolean default true
);
create or replace function cron.schedule(text, text, text) returns bigint
  language sql as $$ insert into cron.job (jobname, schedule, command)
                     values ($1, $2, $3) returning jobid $$;
create or replace function cron.unschedule(text) returns boolean
  language sql as $$ delete from cron.job where jobname = $1; select true; $$;

create schema if not exists net;
create or replace function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000
) returns bigint language sql as $$ select 1::bigint $$;

create or replace function public.vault_secret(text) returns text
  language sql as $$ select 'stub'::text $$;

grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

create table cron.job_run_details (
  jobid bigint, runid bigserial primary key, status text,
  return_message text, start_time timestamptz, end_time timestamptz
);
