-- =====================================================================
-- 106: Default coaching cue per exercise, filled into the coach notes
-- when the exercise is added to a workout or program day. Also moves the
-- rest written in template notes ("2 min rest between rounds") into the
-- Rest box. Safe to re-run: only fills blanks.
-- =====================================================================
alter table public.exercises
  add column if not exists default_notes text
  check (default_notes is null or length(btrim(default_notes)) between 1 and 300);

-- 1. Seed a short external-focus cue for every exercise without one.
--    Order matters: the first pattern that matches the name wins; then the
--    exercise's own written tip; then a cue for its category. Tests get none.
with r(ord, pat, cue) as (values
  (1, '^test\M|\mtest -', null),
  (2, 'trigger release|foam roll|soft tissue|lacrosse ball|massage', 'Breathe slowly and let the muscle relax onto the pressure; uncomfortable is fine, sharp pain isn''t.'),
  (3, 'nerve glide|neural|flossing', 'Gentle and rhythmic; ease off before any tingling or symptoms build.'),
  (4, '\mcars?\M|controlled articular', 'Move slowly to the edge of your range; nothing else in the body moves.'),
  (5, 'stretch|mobility|mobilisation|mobilization', 'Breathe out into the end position; ease in, no bouncing.'),
  (6, 'iso(metric)? mid[- ]thigh pull|\mimtp\M', 'Push the floor away as hard and as fast as you can; stay locked in position.'),
  (7, 'jump shrug', 'Push the floor away, then explode up onto your toes and shrug hard; arms stay long.'),
  (8, 'high pull', 'Push the floor away, snap the hips, then pull the elbows high and wide; bar stays close.'),
  (9, 'clean pull|snatch pull', 'Push the floor away, then snap the hips through; bar stays close, finish tall on the toes.'),
  (10, 'clean|snatch', 'Push the floor away, snap the hips, then pull yourself under fast; bar stays close.'),
  (11, 'jerk|push press', 'Short, straight dip, then drive through the legs and punch the bar to the ceiling.'),
  (12, '^(?!.*behind (the )?neck).*(neck|cervical|chin tuck)', 'Slow and controlled through the range; stop well short of pain.'),
  (13, 'slam', 'Reach tall, then slam it through the floor using your whole body.'),
  (14, 'scoop|shot ?put|rotational.*(throw|toss|pass)|(throw|toss).*rotation', 'Load the back hip, then turn fast; the throw comes from the hips, not the arms.'),
  (15, 'chest (pass|throw|push)|medball push|chest press throw|bench throw|landmine throw|punch throw', 'Explode through the ball; throw it through the wall, not to it.'),
  (16, 'overhead.*(throw|pass)|(throw|pass).*overhead|wall ball', 'Ribs down, then whip it from the trunk; full extension at release.'),
  (17, 'throw|toss', 'Accelerate all the way through the release; every rep at full intent.'),
  (18, 'pogo', 'Stiff ankles, quick off the ground; bounce like the floor is hot.'),
  (19, 'depth (jump|drop)|drop jump|drop to', 'Land soft and stable, then go; spend as little time on the ground as possible.'),
  (20, 'bound|\mhops?\M|hop (and|to)', 'Drive the knee and arms forward; stick each landing quiet and balanced.'),
  (21, 'broad jump|long jump', 'Swing hard and jump out as far as you can; stick the landing.'),
  (22, 'plyo push|clap push|explosive push|plyometric push', 'Push the floor away explosively; land soft and keep the plank tight.'),
  (23, 'jump|hurdle|plyo|skater', 'Jump as high or far as you can; land quiet with knees tracking over your toes.'),
  (24, 'decel', 'Sink the hips and brake with short, choppy steps; chest over the knees.'),
  (25, 'sprint|acceleration|\mstarts?\M|resisted run|sled (push|drag|pull)|prowler', 'Drive the ground back behind you; stay tall through the hips.'),
  (26, '\mskips?\M|a-skip|b-skip', 'Stay tall and punch the knee up; quick, springy contacts.'),
  (27, 'shuffle|carioca|crossover (step|run)|change of direction|\mcod\M|agility|ladder', 'Stay low and light on your feet; push off the outside foot.'),
  (28, 'assault bike|air bike|echo bike|\mbike\M|cycling|\merg\M|rower|rowing|skierg|ski erg|treadmill|running|\mrun\M|jog', 'Hit the target effort and hold it; relax your shoulders and breathe.'),
  (29, 'sparring|rolling|pad work|bag work|shadow ?box|boxing|kickboxing|muay thai|wrestling|bjj|grappling', 'Stay relaxed and breathe on every exchange; work to the target effort.'),
  (30, 'side bend|lateral flexion', 'Bend straight to the side and back; no twisting.'),
  (31, 'farmer|suitcase|carry|yoke|waiter walk', 'Walk tall with short, quick steps; don''t let the weight lean you.'),
  (32, 'nordic', 'Lower as slowly as you can; keep your hips locked in a straight line.'),
  (33, 'hamstring curl|leg curl|slider curl|ball curl|swiss ?ball.*curl', 'Pull the heels to your glutes; keep the hips from piking.'),
  (34, 'back extension|reverse hyper|roman chair|45 ?deg', 'Hinge from the hips and finish tall; squeeze the glutes, don''t over-arch.'),
  (35, 'hip thrust|glute bridge|\mbridge\M.*(glute|hip)|frog pump', 'Drive through the heels; ribs down and finish with the glutes, not the lower back.'),
  (36, '(single leg|\msl\M|b-stance|kickstand).*(rdl|romanian|hinge|deadlift)|(rdl|hinge).*(single leg|\msl\M)', 'Reach the back heel to the wall behind you; hips stay square to the floor.'),
  (37, 'rdl|romanian|stiff leg|good ?morning', 'Push your hips back to the wall behind you; soft knees, weight close.'),
  (37.5, 'trap ?bar', 'Push the floor away and stand tall; squeeze the handles hard.'),
  (38, 'deadlift|block pull|rack pull|\mpulls?\M from|tyre flip', 'Push the floor away; keep the bar against your legs and stand tall at the top.'),
  (39, '^(?!.*leg swing).*swing', 'Snap the hips like you''re jumping; let the bell float, arms are just ropes.'),
  (40, 'leg press|hack squat|pendulum', 'Push through the whole foot; lower back stays on the pad.'),
  (41, 'leg extension|short arc|terminal knee|\mtke\M|spanish squat|reverse nordic|sissy', 'Squeeze the quad hard at the top; lower slowly.'),
  (42, 'step ?down|pistol|single leg squat|skater squat|\mrnt\M', 'Knee tracks over the middle toes; control the way down.'),
  (43, 'cossack|lateral lunge|side lunge', 'Sit back into the working hip; keep that heel flat.'),
  (44, 'step ?up', 'Drive through the top foot and stand tall; don''t push off the bottom leg.'),
  (45, 'split squat|lunge|\mrfess\M|bulgarian', 'Drop the back knee straight down; drive through the whole front foot.'),
  (46, 'front squat|zercher', 'Elbows high, chest proud; sit straight down between your hips.'),
  (47, 'box squat', 'Sit back to the box and stay tight; drive up through the floor.'),
  (48, 'squat', 'Spread the floor with your feet; sit down between your hips, chest proud.'),
  (49, 'calf|heel raise|toe walk|tib(ialis)? raise', 'Rise tall through the big toe; pause at the top and lower slowly.'),
  (50, 'adduct|copenhagen', 'Squeeze the knees in and keep the hips stacked; body in one straight line.'),
  (51, 'abduct|clam|monster walk|lateral walk|band walk|miniband walk|fire hydrant', 'Lead with the knee; keep the pelvis still so the side of the hip does the work.'),
  (52, 'hip flexor|psoas|knee drive|march', 'Drive the knee up without leaning back; ribs stay down.'),
  (53, 'scap(ula)? pull|scap(ula)? (shrug|depression)', 'Arms stay straight; pull the shoulders down away from your ears.'),
  (54, 'russian twist|wood ?chop', 'Turn from the hips and trunk together; control the way back.'),
  (55, 'pull ?-?up|chin ?-?up|muscle up', 'Pull your elbows down to your ribs; chest to the bar, no swinging.'),
  (56, 'pulldown|pull down|pullover|straight arm', 'Drive the elbows down to your back pockets; chest stays up.'),
  (57, 'face pull|pull apart|reverse fly|rear delt|\mi-?y-?t\M|\my raise|\mt raise|\mytwl?\M|prone (y|t|w)|\mw raise', 'Pull the hands apart and squeeze the shoulder blades back; keep the neck relaxed.'),
  (58, '\mrow', 'Drive the elbow to your back pocket; chest stays still.'),
  (59, 'shrug', 'Shoulders straight up to the ears; pause at the top.'),
  (60, 'external rotation|internal rotation|\mer\M|\mir\M|rotator', 'Keep the elbow fixed; rotate slowly through the range.'),
  (61, 'lateral raise|side raise|\mlu raise|front raise', 'Lead with the elbows and reach out to the walls; no shrugging.'),
  (62, 'wrist|grip trainer|gripper|grip squeeze|pinch|forearm|pronation|supination|deviation|roller|plate hold|towel hang|dead hang|bar hang', 'Crush the handle; keep the wrist strong and neutral.'),
  (63, 'jefferson curl', 'Roll down one vertebra at a time; light load, slow and controlled.'),
  (64, '(bicep|hammer|preacher|spider|zottman|reverse|cable|drag) curl|\mcurl', 'Pin the elbows to your sides; squeeze at the top and lower slowly.'),
  (65, 'tricep|pushdown|push down|skull ?crusher|jm press|french press|kickback|overhead extension', 'Elbows stay still; lock out hard and squeeze the back of the arm.'),
  (66, '\mdips?\M', 'Shoulders down away from your ears; push to a full lockout.'),
  (67, 'scap(ular)? push|serratus', 'Push the floor away and let the shoulder blades glide; arms stay straight.'),
  (68, 'push ?-?up|press ?-?up', 'Body moves as one plank; push the floor away.'),
  (69, 'fly|flye|pec deck|crossover', 'Hug a big tree with a slight bend in the elbows; squeeze the chest together.'),
  (70, 'pallof|anti-?rotation|stir the pot|renegade|shoulder tap', 'Resist the pull; hips and ribs stay square.'),
  (71, 'landmine.*press|press.*landmine', 'Punch up and out along the arc; ribs stay down.'),
  (72, 'bench press|\mbench$|floor press|board press|chest press|crush press|squeeze press|larsen|spoto|pin press', 'Shoulder blades pinned back and down; push yourself away from the bar.'),
  (73, 'overhead press|shoulder press|military|strict press|arnold|z press|sots|\mohp\M|torch press|\mpress\M', 'Ribs down and glutes tight; finish with your head through and arms by the ears.'),
  (74, 'side plank|side bridge|lateral plank', 'Hips high, body in one straight line from head to heel.'),
  (75, 'plank|hollow|ab wheel|roll ?out|body saw|stir|bear crawl|bear hold', 'Squeeze the glutes and pull the ribs down; long line from head to heels.'),
  (76, 'dead ?bug', 'Press the lower back into the floor; move the arm and leg slowly without it lifting.'),
  (77, 'bird ?dog', 'Reach long through the hand and heel; hips stay level, no rotation.'),
  (78, 'crunch|sit ?-?up|knee raise|leg raise|toes to bar|tuck|v-up|garhammer|leg lower|jack ?knife', 'Curl the ribs towards the hips and exhale hard; no swinging.'),
  (79, 'low to high|high to low|chop|twist|rotation|windmill|russian|wood ?cutter|\mcoil', 'Turn from the hips and trunk together; control the way back.'),
  (80, 'stretch|90/90|couch|pigeon|child''?s pose|open book|thread the needle|world''?s greatest|mobility|lat hang|thomas', 'Breathe out into the end position; ease in, no bouncing.'),
  (81, 'activation|band|miniband|scap|serratus|wall slide', 'Slow and controlled; feel the target muscle doing the work.')
), c(category, cue) as (values
  ('knee', 'Knee tracks over the middle toes; control the way down and drive up through the whole foot.'),
  ('hip', 'Hinge from the hips with a long spine; drive the hips through to finish.'),
  ('h_press', 'Shoulder blades set back and down; press with control and lock out.'),
  ('v_press', 'Ribs down and glutes tight; press straight up and finish strong.'),
  ('h_pull', 'Lead with the elbow and squeeze the shoulder blade back; chest stays still.'),
  ('v_pull', 'Drive the elbows down to your ribs; chest up.'),
  ('core', 'Brace like you''re about to be punched; breathe behind the brace.'),
  ('ballistic', 'Every rep at full intent; be fast, not just strong.'),
  ('plyometric', 'Quick off the ground; land quiet and stable.'),
  ('cond_mob', 'Move with control and breathe; quality over quantity.'),
  ('accessory', 'Controlled reps; feel the target muscle doing the work.')
), m as (
  select e.id, e.category,
    (select r.ord from r where lower(e.name) ~ r.pat order by r.ord limit 1) ord,
    nullif(btrim(substring(e.cues from '(?:^|\n)Tips?\n([^\n]+)')), '') tip
  from public.exercises e
  where e.default_notes is null
), pick as (
  select m.id, case when m.ord = 1 then null
    else coalesce((select r.cue from r where r.ord = m.ord),
                  case when length(m.tip) <= 300 then m.tip end,
                  (select c.cue from c where c.category = m.category)) end cue
  from m
)
update public.exercises e set default_notes = pick.cue
from pick where pick.id = e.id and pick.cue is not null;

-- 2. Template programs: rest that was only written in the notes goes into the Rest box.
--    Uses the rest between the units the Sets column counts (sets, reps, rounds, rolls,
--    sprints, blocks). Single sets and changing within-set rests stay in the notes.
with b as (
  select i.id, i.notes, lower(substring(i.notes from '^\d+ ([a-z]+)')) u
  from public.program_items i
  where i.kind = 'exercise' and i.rest_sec is null and i.notes is not null
), p as (
  select id, coalesce(
    substring(notes from '(\d+ min(?: \d+)?|\d+s)(?: passive| easy active)? (?:rest|recovery|walk) between ' || u),
    substring(notes from '(\d+ min(?: \d+)?) easy between ' || u),
    case when u = 'reps' then substring(notes from '\| (\d+ min(?: \d+)?) active recovery at RPE') end,
    substring(notes from 'walk down recovery, about (\d+ min)'),
    case when notes ~* '\mno rest\M' then '0s' end,
    substring(notes from '(?i)then rest (\d+) sec') || 's'
  ) d
  from b where u is not null or notes ~* 'then rest'
), s as (
  select id, case when d ~ 'min' then split_part(d, ' ', 1)::int * 60 + coalesce(substring(d from 'min (\d+)')::int, 0)
                  else rtrim(d, 's')::int end sec
  from p where d is not null
)
update public.program_items i set rest_sec = s.sec from s where s.id = i.id and s.sec between 0 and 1800;
