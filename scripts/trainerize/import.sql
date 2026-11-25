-- One-off loader for scripts/trainerize/workouts.json. See README.md.
create or replace function private.tz_reps(r text) returns text language sql immutable as $$
  select case
    when r is null or btrim(r) = '' then null
    when length(r) < 20 then r
    when r ~* '^choose a distance' then 'See note'
    else coalesce(nullif(btrim(substring(r from '^[0-9]+(?:-[0-9]+)?\s*(?:s|min|m|metres|e/s)?')), ''), left(r, 20))
  end
$$;

create or replace function private.import_tz(p jsonb) returns text language plpgsql as $$
declare
  w jsonb; it jsonb; tag text; fname text; parentf uuid; fid uuid; pid uuid; did uuid; ex uuid; nm text; pos int;
  progs int := 0; skipped int := 0; newex int := 0; items int := 0;
  prot uuid; inj uuid; rec uuid; cond uuid; instr text;
begin
  select id into prot from program_folders where name = 'Protocols' and parent_id is null;
  select id into inj from program_folders where name = 'Injury & rehab' and parent_id = prot;
  select id into rec from program_folders where name = 'Recovery' and parent_id = prot;
  select id into cond from program_folders where name = 'Conditioning' and parent_id is null;
  if cond is null then insert into program_folders (name, parent_id, sort_order) values ('Conditioning', null, 50) returning id into cond; end if;
  for w in select * from jsonb_array_elements(p) loop
    tag := w->>1;
    if tag like 'Protocols - %' then
      parentf := inj;
      fname := case tag
        when 'Protocols - Ankle Rehab' then 'Ankle & foot' when 'Protocols - Elbow' then 'Elbow'
        when 'Protocols - Hip' then 'Hip' when 'Protocols - Knee Rehab' then 'Knee'
        when 'Protocols - Neck Rehab' then 'Neck' when 'Protocols - Shoulder Rehab' then 'Shoulder'
        when 'Protocols - Tendinopathy' then 'Tendinopathy' when 'Protocols - Thoracic + Lower Back Rehab' then 'Back & thoracic'
        when 'Protocols - Wrist/Hand' then 'Wrist & hand' else 'Other' end;
    elsif tag = 'Stretch Session' then parentf := null; fname := null; fid := rec;
    else
      parentf := cond;
      fname := case tag when 'Alactic Power' then 'Alactic power' when 'Cardiac Output' then 'Aerobic base'
        when 'Cardiac Power' then 'Aerobic power' else 'Intervals & sessions' end;
    end if;
    if fname is not null then
      select id into fid from program_folders where name = fname and parent_id = parentf;
      if fid is null then insert into program_folders (name, parent_id, sort_order) values (fname, parentf, 100) returning id into fid; end if;
    end if;
    if exists (select 1 from programs where name = left(btrim(w->>0), 80) and folder_id = fid) then skipped := skipped + 1; continue; end if;
    instr := nullif(btrim(regexp_replace(coalesce(w->>3, ''), '\n?(Circuit|Superset) of \d+ rounds?\s*$', '', 'i')), '');
    insert into programs (name, description, weeks, instructions, folder_id)
    values (left(btrim(w->>0), 80), 'Imported from Trainerize' || coalesce('. About ' || (w->>2) || ' min.', '.'), 1, left(instr, 4000), fid)
    returning id into pid;
    insert into program_days (program_id, week_no, day_no, title) values (pid, 1, 1, left(btrim(w->>0), 80)) returning id into did;
    pos := 0;
    for it in select * from jsonb_array_elements(w->4) loop
      pos := pos + 1;
      nm := btrim(it->>0);
      if nm = 'Push Up' then nm := 'Push-Up'; end if;
      ex := null;
      select id into ex from exercises where lower(name) = lower(nm) order by active desc limit 1;
      if ex is null then insert into exercises (name, category) values (left(nm, 80), 'accessory') returning id into ex; newex := newex + 1; end if;
      insert into program_items (day_id, position, kind, exercise_id, block, slot, sets, reps, load_type, rest_sec, notes)
      values (did, pos, 'exercise', ex, it->>1, least(9, (it->>2)::int),
              case when it->>3 is null then null else least(20, greatest(1, (it->>3)::int)) end,
              private.tz_reps(it->>4), 'none',
              case when it->>5 is null then null else least(1800, (it->>5)::int) end,
              nullif(left(it->>6, 2000), ''));
      items := items + 1;
    end loop;
    progs := progs + 1;
  end loop;
  return format('programs %s, skipped %s, items %s, new exercises %s', progs, skipped, items, newex);
end $$;

-- After loading:
-- drop function private.import_tz(jsonb);
-- drop function private.tz_reps(text);
