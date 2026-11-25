-- =====================================================================
-- Migration 086 — performance tidy-up from the Supabase advisor.
--   1. RLS policies call auth.uid() once per query instead of once per row:
--      auth.uid() → (select auth.uid()). Same rules, faster at scale.
--   2. Index every foreign key that has no covering index (faster joins and
--      faster deletes that cascade).
-- Both steps are generated from the live catalog so they also fit the live DB.
-- =====================================================================
do $$
declare
  p record;
  q text;
  c text;
  stmt text;
  keep constant text := '__TYP_UID__';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
  loop
    q := p.qual;
    c := p.with_check;
    if q is not null then
      q := replace(q, '( SELECT auth.uid() AS uid)', keep);
      q := replace(q, 'auth.uid()', '(select auth.uid())');
      q := replace(q, keep, '(select auth.uid())');
    end if;
    if c is not null then
      c := replace(c, '( SELECT auth.uid() AS uid)', keep);
      c := replace(c, 'auth.uid()', '(select auth.uid())');
      c := replace(c, keep, '(select auth.uid())');
    end if;
    if q is distinct from p.qual or c is distinct from p.with_check then
      stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if q is not null then stmt := stmt || format(' using (%s)', q); end if;
      if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
      execute stmt;
    end if;
  end loop;
end $$;

do $$
declare
  fk record;
  cols text;
  idx text;
begin
  for fk in
    select con.conrelid, con.conname, con.conkey, cl.relname
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and (i.indkey::int2[])[0:cardinality(con.conkey) - 1] @> con.conkey
          and (i.indkey::int2[])[0:cardinality(con.conkey) - 1] <@ con.conkey)
  loop
    select string_agg(format('%I', a.attname), ', ' order by k.ord)
      into cols
      from unnest(fk.conkey) with ordinality k(attnum, ord)
      join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = k.attnum;
    idx := left(fk.relname || '_' || replace(replace(cols, '"', ''), ', ', '_') || '_fk_idx', 63);
    execute format('create index if not exists %I on public.%I (%s)', idx, fk.relname, cols);
  end loop;
end $$;
