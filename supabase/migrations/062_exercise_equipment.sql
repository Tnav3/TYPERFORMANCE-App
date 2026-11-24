-- =====================================================================
-- Migration 062 — equipment per exercise (tick boxes), filled in from
-- the Trainerize tags and exercise names. Workouts show what's needed.
-- =====================================================================
alter table public.exercises add column if not exists equipment text[] not null default '{}'
  check (equipment <@ array['barbell', 'dumbbell', 'kettlebell', 'plate', 'bench', 'rack', 'trap_bar', 'ez_bar', 'ssb', 'smith', 'landmine', 'cable', 'machine', 'pullup_bar', 'suspension', 'ghd', 'box', 'band', 'mini_band', 'med_ball', 'slam_ball', 'swiss_ball', 'sliders', 'foam_roller', 'hurdles', 'sled', 'jump_rope', 'bag', 'bike', 'rower', 'skierg', 'treadmill']::text[]);

create or replace function public.guess_equipment(p_name text, p_tags text[])
returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(k order by k), '{}') from (
    select k from (values
      ('barbell',    '(barbell|\mbb\M|bench press|back squat|front squat|deadlift|good morning|pendlay|zercher|power clean|hang clean|snatch|jerk|push press|pin press|floor press|military)', array['barbell']),
      ('dumbbell',   '(dumbbell|\mdb\M|db/kb)', array['dumbbell']),
      ('kettlebell', '(kettlebell|\mkb\M|db/kb)', array['kettlebell']),
      ('plate',      '(\mplate\M)', array['plate']),
      ('bench',      '(bench|seal row)', array['bench']),
      ('rack',       '(back squat|front squat|rack|pin press|pin squat|\mpins\M|military|overhead press|zercher)', array[]::text[]),
      ('trap_bar',   '(trap ?bar|hex bar)', array[]::text[]),
      ('ez_bar',     '(ez bar)', array['ez bar']),
      ('ssb',        '(safety bar|safety squat|\mssb\M|hssb)', array[]::text[]),
      ('smith',      '(smith)', array['smith machine']),
      ('landmine',   '(landmine)', array['landmine']),
      ('cable',      '(cable|keiser)', array['cable']),
      ('machine',    '(machine|hammer strength|leg press|hack squat|pendulum|belt squat|leg curl|leg extension|pec deck)', array['machine']),
      ('pullup_bar', '(pull ?up|chin ?up|hanging|dead hang|toes to bar|muscle up)', array['pull up bar']),
      ('suspension', '(\mtrx\M|\mrings?\M|suspension)', array['suspension']),
      ('ghd',        '(\mghd\M|glute ham|roman chair|reverse hyper)', array[]::text[]),
      ('box',        '(\mbox\M|step up|step-up|step down|depth|\mstep\M)', array['box']),
      ('band',       '(\mband|powerband|banded)', array['bands (loops)', 'bands (handles)']),
      ('mini_band',  '(mini ?band)', array['mini band']),
      ('med_ball',   '(med ?ball|medicine ball)', array['medicine ball']),
      ('slam_ball',  '(slam ball|dead ?ball)', array['slam ball']),
      ('swiss_ball', '(swiss ?ball|stability ball)', array['swiss ball']),
      ('sliders',    '(slider)', array['sliders']),
      ('foam_roller','(foam roll)', array['foam roller']),
      ('hurdles',    '(hurdle|cone)', array[]::text[]),
      ('sled',       '(\msled)', array['sled']),
      ('jump_rope',  '(skipping|jump rope)', array['jump rope']),
      ('bag',        '(heavy bag|grappling dummy)', array[]::text[]),
      ('bike',       '(\mbike\M|assault)', array[]::text[]),
      ('rower',      '(rower)', array[]::text[]),
      ('skierg',     '(ski ?erg)', array[]::text[]),
      ('treadmill',  '(treadmill)', array[]::text[])
    ) as r(k, rx, tg)
    where lower(coalesce(p_name, '')) ~ r.rx or coalesce(p_tags, '{}') && r.tg
  ) x
  -- "mini band" shouldn't also count as a big band
  where not (k = 'band' and lower(coalesce(p_name, '')) ~ 'mini ?band' and lower(coalesce(p_name, '')) !~ 'powerband')
    -- lift names imply a barbell only when nothing else is named
    and not (k = 'barbell' and lower(coalesce(p_name, '')) !~ 'barbell' and not ('barbell' = any(coalesce(p_tags, '{}')))
             and lower(coalesce(p_name, '')) ~ '(dumbbell|kettlebell|\mdb\M|\mkb\M|cable|machine|smith|landmine|trap ?bar|safety|swiss bar|keiser|band|isometric|overcoming)')
$$;

update public.exercises set equipment = public.guess_equipment(name, tags) where equipment = '{}';

-- New exercises get a first guess the coach can tick or untick
create or replace function public.exercise_equipment_default()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and (new.equipment is null or new.equipment = '{}') then
    new.equipment := public.guess_equipment(new.name, new.tags);
  end if;
  return new;
end;
$$;
create trigger exercise_equipment_default before insert on public.exercises
  for each row execute function public.exercise_equipment_default();
