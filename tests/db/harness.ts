// Runs our Supabase migrations inside an in-memory Postgres (PGlite),
// with a minimal stand-in for Supabase's auth schema and roles.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- Minimal stand-in for Supabase Storage
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text not null, owner uuid default auth.uid()
);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
`;

// Supabase grants these by default on the public schema
const SUPABASE_DEFAULT_GRANTS = `
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(__dirname, "../../supabase/migrations");
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  await db.exec(SUPABASE_DEFAULT_GRANTS);
  return db;
}

/** Create an auth user (as Supabase would on signup). Returns id. */
export async function signUp(db: PGlite, email: string, fullName?: string) {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(fullName ? { full_name: fullName } : {})],
  );
  return r.rows[0].id;
}

/** Run a callback as a logged-in app user (role "authenticated"). */
export async function asUser<T>(
  db: PGlite,
  uid: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(
    `select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`,
  );
  await db.exec(uid ? `set role authenticated` : `set role anon`);
  try {
    return await fn();
  } finally {
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub', '', false)`,
    );
  }
}

/** Make someone the coach — mirrors the one-off SQL in the setup guide. */
export async function makeCoach(db: PGlite, email: string) {
  await db.query(
    `update public.profiles set role = 'coach', status = 'active' where email = $1`,
    [email],
  );
}
