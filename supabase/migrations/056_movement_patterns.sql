-- =====================================================================
-- Migration 056 — simpler exercise library: movement-pattern categories + subcategories.
--   Old categories (strength/power/plyometric/…) are replaced. Every exercise is
--   sorted automatically from its name and Trainerize tags; the coach can fix any.
--   New exercises are sorted the same way when added without a subcategory.
-- =====================================================================
create or replace function public.classify_exercise(p_name text, p_tags text[], p_old text)
returns text[] language plpgsql immutable set search_path = public
as $$
declare n text := ' ' || lower(coalesce(p_name, '')) || ' '; t text[] := coalesce(p_tags, '{}');
        db text := '(dumbbell|kettlebell|\mdb\M|\mkb\M|db/kb|cable|machine|band|keiser)';
begin
  -- 1. The name decides when it clearly says what the movement is (Trainerize tags are noisy).
  if n ~ '(slam|toss|throw|shotput|shot put|chest pass|wall pass|scoop)' then
    return array['ballistic', case when n ~ '(rotat|side|scoop|shotput|shot put|backward|coil)' then 'throw_rot'
                                    when n ~ '(overhead|slam|granny)' then 'throw_oh' else 'throw_chest' end];
  end if;
  if n ~ '(power clean|hang clean|muscle clean|clean pull|clean high|clean \+|snatch high|snatch pull|power snatch|hang snatch|jerk|high pull|push press|panda pull|mid-thigh pull|mid thigh pull)' then return array['ballistic', 'olympic']; end if;
  if n ~ '(plyo push|clap push|drop push)' then return array['ballistic', 'upper']; end if;
  if n ~ '(foam roll|lacrosse|trigger release|soft tissue|smash)' then return array['cond_mob', 'soft_tissue']; end if;
  if n ~ '(stretch|opener|90/90|\mcars\M|mobilis|mobiliz|nerve glide|pigeon|couch|pancake|straddle|butterfly)' then return array['cond_mob', 'stretch']; end if;
  if p_old = 'mobility' then return array['cond_mob', 'activation']; end if;
  if n ~ '(jump|pogo|\mhops?\M|bound|depth drop|depth landing|box blast|snap down|\mskip\M|skips)' then
    return array['ballistic', case when n ~ '(\mhops?\M|bound|skip|pogo)' then 'bounds' else 'jumps' end];
  end if;
  if n ~ '(assault bike|\mbike\M|rower|skierg|ski erg|treadmill|sprint|\mrun\M|run drill|skipping|shadow box|heavy bag|sparring|sled push|sled pull|sled drag|ladder drill|stair|combo|combination|grappling dummy|battle rope|jump rope|\mwalk\M|swim|boxing|punch|sprawl|burpee|shuffle|back pedal|backpedal|\mmarch|accel|seal jack|jumping jack|crawl|\mgame\M|fast leg|active recovery|time trial)' then
    return array['cond_mob', 'conditioning'];
  end if;
  if n ~ 'neck' then return array['accessory', 'neck']; end if;
  if n ~ '(pallof|plank|deadbug|dead bug|hollow|sit up|sit-up|crunch|russian twist|side bridge|torso twist|woodchop|wood chop|\mchop\M|rollout|roll out|ab wheel|copenhagen|slide out|v-sit|l-sit|leg raise|knee raise|toes to bar|bird dog|side bend|windmill|corkscrew|leg lower|tuck up|oblique)'
     or (n ~ '(rotation|twist)' and n !~ '(external|internal|thoracic|trunk|hip) rotation') then
    return array['core', case when n ~ '(pallof|anti-rotation|suitcase|bird dog)' then 'anti_rot'
                              when n ~ '(side plank|copenhagen|side bridge|lateral|oblique|side hollow|side bend|windmill)' then 'lateral'
                              when n ~ '(rotation|twist|chop|lift|rainbow|windshield|corkscrew)' then 'rotation'
                              when n ~ '(sit up|sit-up|crunch|knee raise|leg raise|v-sit|l-sit|hip flex|toes to bar|jackknife|tuck)' then 'flexion'
                              when 'anti-rotation core' = any(t) then 'anti_rot'
                              else 'anti_ext' end];
  end if;
  if n ~ '(pull up|pull-up|pullup|chin up|chin-up|chinup|pulldown|pull down|pullover|muscle up)' then
    return array['v_pull', case when n ~ '(pulldown|pull down|pullover)' then 'pulldown' else 'pull_up' end];
  end if;
  if n ~ '(overhead press|shoulder press|military|z-press|z press|landmine press|landmine oscillation|arnold|handstand|pike push|strict press|bradford|sots press|torch press|bottoms? up press)' then
    return array['v_press', case when n ~ 'landmine' then 'landmine' when n ~ db then 'dumbbell' else 'barbell' end];
  end if;
  if n ~ '(bench press|push up|push-up|pushup|floor press|chest press|\mdips?\M|pin press|board press|spoto|larsen|incline .*press|speed bench|crush press|zanetti)' then
    return array['h_press', case when n ~ '(push up|push-up|pushup|\mdips?\M)' then 'push_up' when n ~ db then 'dumbbell' else 'barbell' end];
  end if;
  if n ~ '(squat|lunge|step up|step-up|stepup|step down|leg press|pistol|wall sit|leg extension|sissy|skater|cyclist|\mrfe\M|bulgarian|\mtke\M|terminal knee)' then
    return array['knee', case when n ~ '(step up|step-up|stepup|patrick step|box step|step down)' then 'step_up'
                              when n ~ '(lunge|split squat|\mrfe\M|rear foot|bulgarian|\mffe\M)' then 'lunge'
                              when n ~ '(pistol|single leg|single-leg|\msl\M|skater|shrimp|cossack)' then 'single_leg'
                              else 'squat' end];
  end if;
  if n ~ '(deadlift|\mrdl\M|good morning|hinge|hip thrust|glute bridge|bridge|hamstring curl|leg curl|nordic|razor curl|harop|glute ham|\mghr\M|back extension|hyperextension|swing|pull through|pull-through|reverse hyper|hip extension|kickstand|b-stance|block pull|rack pull)' then
    return array['hip', case when n ~ '(thrust|bridge)' then 'thrust'
                             when n ~ '(curl|nordic|glute ham|\mghr\M)' then 'curl'
                             when n ~ '(single leg|single-leg|\msl\M|kickstand|b-stance|staggered)' then 'single_leg'
                             else 'hinge' end];
  end if;
  if n ~ '(\mrows?\M|face pull|rear delt|reverse fly|pull apart|pull-apart|inverted|retraction)' then return array['h_pull', 'rows']; end if;
  if n ~ '(pec fly|chest fly|\mfly\M|flye)' then return array['h_press', 'dumbbell']; end if;
  if n ~ '(carry|farmer|wrist|grip|forearm|finger|dead hang|towel hang|plate pinch|pronation|supination|ulnar|radial)' then return array['accessory', 'grip']; end if;
  if n ~ '(calf|tibialis|tib raise|\mtib\M|ankle|heel raise|toe raise|plantar|eversion|inversion|toe curl|toe piano|barefoot)' then return array['accessory', 'calves']; end if;
  if n ~ '(abduct|adduct|clam|hip flex|hip lock|hip airplane|groin|fire hydrant|monster walk|lateral walk|glute|hip internal|hip external)' and n !~ 'shoulder' then return array['accessory', 'hips']; end if;
  if n ~ '(curl|tricep|skull|pushdown|push down|kickback|bicep|hammer)' then return array['accessory', 'arms']; end if;
  if n ~ '(raise|external rotation|internal rotation|\mer\M|\mir\M|scap|serratus|shrug|delt|\my\M|\mw\M|\mt\M|wty|tyi|cuban|halo|shoulder|tantrum|prone dart)' then
    return array['accessory', 'shoulders'];
  end if;
  if n ~ '\mpress\M' then return array['h_press', case when n ~ db then 'dumbbell' else 'barbell' end]; end if;
  -- 2. Fall back on the old category and the tags.
  if p_old in ('plyometric', 'power') or 'plyometrics' = any(t) then return array['ballistic', 'jumps']; end if;
  if p_old = 'conditioning' then return array['cond_mob', 'conditioning']; end if;
  if p_old = 'mobility' or 'static stretches' = any(t) then return array['cond_mob', case when 'static stretches' = any(t) then 'stretch' else 'activation' end]; end if;
  if p_old = 'core' or 'anti-extension core' = any(t) or 'anti-rotation core' = any(t) then
    return array['core', case when 'anti-rotation core' = any(t) then 'anti_rot' else 'anti_ext' end];
  end if;
  if 'vertical pull' = any(t) then return array['v_pull', null]; end if;
  if 'horizontal pull' = any(t) then return array['h_pull', 'rows']; end if;
  if 'vertical push' = any(t) then return array['v_press', null]; end if;
  if 'horizontal push' = any(t) then return array['h_press', null]; end if;
  if 'knee dominant' = any(t) then return array['knee', null]; end if;
  if 'hip dominant' = any(t) then return array['hip', null]; end if;
  if 'calves' = any(t) then return array['accessory', 'calves']; end if;
  if 'forearms' = any(t) then return array['accessory', 'grip']; end if;
  if 'bicep' = any(t) or 'triceps' = any(t) then return array['accessory', 'arms']; end if;
  if 'shoulder (side)' = any(t) or 'shoulder (rear)' = any(t) or 'traps' = any(t) then return array['accessory', 'shoulders']; end if;
  if 'abductors' = any(t) or 'adductors' = any(t) then return array['accessory', 'hips']; end if;
  return array['accessory', null];
end;
$$;

-- Swap the old categories for the new ones
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.exercises'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%category%' loop
    execute format('alter table public.exercises drop constraint %I', c);
  end loop;
end $$;
alter table public.exercises add column if not exists subcategory text;

update public.exercises e set category = x.c[1], subcategory = x.c[2]
from (select id, public.classify_exercise(name, tags, category) c from public.exercises) x
where x.id = e.id;

alter table public.exercises add constraint exercises_category_check check (category in
  ('knee', 'hip', 'h_press', 'v_press', 'h_pull', 'v_pull', 'ballistic', 'core', 'accessory', 'cond_mob'));
alter table public.exercises add constraint exercises_subcategory_check check (subcategory is null or category || '.' || subcategory in (
  'knee.squat', 'knee.lunge', 'knee.step_up', 'knee.single_leg',
  'hip.hinge', 'hip.thrust', 'hip.curl', 'hip.single_leg',
  'h_press.barbell', 'h_press.dumbbell', 'h_press.push_up',
  'v_press.barbell', 'v_press.dumbbell', 'v_press.landmine',
  'h_pull.rows', 'v_pull.pull_up', 'v_pull.pulldown',
  'ballistic.jumps', 'ballistic.bounds', 'ballistic.throw_rot', 'ballistic.throw_oh', 'ballistic.throw_chest', 'ballistic.olympic', 'ballistic.upper',
  'core.anti_ext', 'core.anti_rot', 'core.rotation', 'core.lateral', 'core.flexion',
  'accessory.arms', 'accessory.shoulders', 'accessory.calves', 'accessory.neck', 'accessory.grip', 'accessory.hips',
  'cond_mob.conditioning', 'cond_mob.stretch', 'cond_mob.soft_tissue', 'cond_mob.activation'));
create index if not exists exercises_pattern_idx on public.exercises (category, subcategory) where active;

-- New exercises: an old-style or missing category is sorted automatically; a missing subcategory is filled in when it fits.
create or replace function public.exercise_autosort()
returns trigger language plpgsql set search_path = public as $$
declare c text[];
begin
  if new.category not in ('knee', 'hip', 'h_press', 'v_press', 'h_pull', 'v_pull', 'ballistic', 'core', 'accessory', 'cond_mob') then
    c := public.classify_exercise(new.name, new.tags, new.category);
    new.category := c[1];
    new.subcategory := coalesce(new.subcategory, c[2]);
  else
    -- moved to another category: an old subcategory no longer fits
    if tg_op = 'UPDATE' and new.category is distinct from old.category and new.subcategory is not distinct from old.subcategory then
      new.subcategory := null;
    end if;
    if new.subcategory is not null then return new; end if;
    c := public.classify_exercise(new.name, new.tags, null);
    if c[1] = new.category then new.subcategory := c[2]; end if;
  end if;
  return new;
end;
$$;
create trigger exercise_autosort before insert or update of category on public.exercises
  for each row execute function public.exercise_autosort();
