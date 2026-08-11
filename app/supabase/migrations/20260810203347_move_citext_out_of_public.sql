-- Extensions in `public` share a namespace with application objects, which is
-- how you end up with a user-created function shadowing an extension one.
-- Move citext to `extensions` alongside pgcrypto. Columns keep their type; the
-- type is simply resolved from a different schema, and `extensions` is already
-- on the search_path for every function in this database.
alter extension citext set schema extensions;

-- Anything that referenced the type unqualified still resolves, but be explicit
-- in the places that matter.
select n.nspname as citext_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
 where e.extname = 'citext';