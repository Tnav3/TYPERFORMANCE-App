-- =====================================================================
-- Migration 096 — Learn glossary + habit library.
-- glossary_terms: the coach's training explainers (AMRAP, tempo, RIR...),
--   searchable by clients on /learn and linked from the workout screen.
-- habit_templates: the coach's habit library; assigning copies name + details
--   onto the client's habit.  habits.details: instructions/links shown to the client.
-- Content copied from the coach's own Trainerize library (101 Tutorials, Extra).
-- =====================================================================
create table public.glossary_terms (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique check (key ~ '^[a-z0-9-]{2,40}$'),
  title      text not null check (length(btrim(title)) between 2 and 80),
  aliases    text[] not null default '{}',
  what       text not null check (length(what) between 2 and 2000),
  how        text check (how is null or length(how) <= 2000),
  why        text check (why is null or length(why) <= 1000),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.glossary_terms enable row level security;
create policy "glossary_read" on public.glossary_terms for select to authenticated using (public.is_coach() or public.is_active_user());
create policy "glossary_coach" on public.glossary_terms for all to authenticated using (public.is_coach()) with check (public.is_coach());

create table public.habit_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) between 2 and 80),
  details    text check (details is null or length(details) <= 2000),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.habit_templates enable row level security;
create policy "habit_templates_coach" on public.habit_templates for all to authenticated using (public.is_coach()) with check (public.is_coach());

alter table public.habits add column if not exists details text check (details is null or length(details) <= 2000);

insert into public.glossary_terms (key, title, aliases, what, how, why, sort_order) values
  ('amrap', 'AMRAP (As Many Reps as Possible)', array['AMRAP','max reps']::text[], 'One set where you keep going until you can''t complete another good rep.', 'Use the prescribed weight. Stop when your technique changes or the rep grinds, not when you physically fail. Log the number you hit.', 'It shows where your strength is right now so your loads can be adjusted.', 0),
  ('back-off', 'Back-Off Set', array['back-off','backoff','back off']::text[], 'Lighter sets done after your Top Set.', 'Reduce the weight as prescribed and complete the sets with clean, consistent reps.', 'Adds the volume you need to keep progressing without the fatigue of more heavy sets.', 1),
  ('cluster', 'Cluster Set', array['cluster']::text[], 'One set broken into smaller chunks with short rests in between.', 'Example: 6 reps done as 2 + 2 + 2, putting the weight down for 15 to 30 seconds between chunks. Take your full rest only after the whole cluster is done.', 'The short breaks keep every rep fast and clean at a weight you couldn''t manage in one go.', 2),
  ('contrast', 'Contrast Set', array['contrast']::text[], 'A heavy lift followed by a fast, explosive movement that uses the same muscles.', 'Do the heavy lift, rest as prescribed, then do the explosive movement with maximum speed and intent. Rest fully before the next round.', 'Trains your body to turn strength into power.', 3),
  ('density', 'Density Set', array['density']::text[], 'A block of time instead of a fixed number of sets.', 'Start the timer and complete as many quality reps or rounds as you can before it runs out. Rest when you need to, but keep breaks short. Log your total.', 'Next time the goal is more work in the same time, which builds work capacity.', 4),
  ('drop-set', 'Drop Set', array['drop set','drop sets','dropset']::text[], 'A set where you hit your reps, reduce the weight straight away and keep going.', 'Finish the set, drop the weight by roughly 10-20%, and continue with no rest. Repeat for the number of drops prescribed. Stop each drop when your form changes.', 'Extends the set past where you would normally stop, adding muscle-building work in very little time.', 5),
  ('giant-set', 'Giant Set', array['giant set','giant sets']::text[], 'Four or more exercises done back to back, with rest only after the last one.', 'Work through each exercise in order with minimal rest between them, then rest as prescribed before the next round.', 'Packs a lot of work into a short time and builds your ability to keep working under fatigue.', 6),
  ('plus-set', 'Plus Set', array['plus set']::text[], 'A final set where you do the prescribed reps plus as many more good reps as you can. Written with a plus sign, e.g. 5+.', 'Do your earlier sets as normal. On the last set, keep going past the target and stop when your technique changes. Log the number you hit.', 'Shows whether you are getting stronger and helps set your next loads.', 7),
  ('pyramid', 'Pyramid Set', array['pyramid']::text[], 'Sets where the weight goes up as the reps come down, then back the other way.', 'Example: 10 reps, 8 reps, 6 reps, 8 reps, 10 reps. Add weight as the reps drop, then take it off as the reps climb.', 'Builds you up to your heaviest set, then adds extra volume on the way back down.', 8),
  ('superset', 'Superset', array['superset']::text[], 'Two exercises done back to back, with rest only after the second one.', 'Do the first exercise, move straight to the second, then rest as prescribed. That is one round.', 'More quality work in less time.', 9),
  ('top-set', 'Top Set', array['top set']::text[], 'Your heaviest set of the day for that exercise.', 'Build up with lighter sets first, then do one set at the prescribed weight or effort. Log the weight and reps.', 'Gives you heavy, high-quality practice and a clear number to beat.', 10),
  ('triset', 'Triset', array['triset','tri-set']::text[], 'Three exercises done back to back, with rest only after the third one.', 'Work through all three in order with minimal rest between them, then rest as prescribed. That is one round.', 'More quality work in less time than doing each exercise on its own.', 11),
  ('emom', 'EMOM (Every Minute on the Minute)', array['EMOM']::text[], 'You start a new set at the top of every minute.', 'Start the timer, do the prescribed reps, then rest for whatever is left of that minute. Repeat for the number of minutes prescribed.', 'Keeps rest honest and consistent, so every set is done at the same quality.', 12),
  ('open-set', 'Open Set', array['open set']::text[], 'The sets and reps are given, but the weight is yours to choose.', 'Pick a weight that lets you complete every rep with good form at the effort prescribed. Check your last session and aim to beat it by a small amount.', 'Matches the load to how you are performing on the day and teaches you to judge your own effort.', 13),
  ('alap', 'ALAP (As Long as Possible)', array['ALAP']::text[], 'A hold, hang or carry done for maximum time instead of a set number of reps.', 'Start the timer, hold the position, and stop the moment your form breaks. Log your time.', 'Builds strength endurance in that position and gives you a time to beat.', 14),
  ('rir', 'RIR (Reps in Reserve)', array['RIR','reps in reserve']::text[], 'How many more good reps you could have done when you finish a set.', '2 RIR means you stop with two good reps left. 0 RIR means you could not do another good rep. If you finish and had more left than prescribed, go heavier next set.', 'Keeps you working hard enough to progress without burning out, and lets the weight match how you feel on the day.', 15),
  ('tempo', 'Tempo', array['tempo']::text[], 'Four numbers that tell you how fast to move through each part of a rep, in seconds.', 'Example: 3-1-X-1 means 3 seconds lowering, 1 second pause at the bottom, X means lift as fast as you can, 1 second pause at the top. The first number is always the lowering phase, even if the exercise starts with the lift.', 'Controls how the rep is done so the right quality is being trained, not just the weight being moved.', 16),
  ('rest-pause', 'Rest-Pause', array['rest-pause','rest pause']::text[], 'One set stretched out by taking very short rests and going again with the same weight.', 'Do your reps until you are close to your limit, rest 15 to 20 seconds, then do as many more good reps as you can. Repeat as prescribed.', 'Gets extra hard reps out of one set. Unlike a Cluster Set, you push close to your limit before each rest.', 17),
  ('vbt', 'VBT (Velocity Based Training)', array['VBT','m/s','velocity','bar speed']::text[], 'Using the speed of the bar, measured in metres per second (m/s), to guide your training instead of weight and reps alone.', 'Lift every rep as fast as you can, with the same technique and depth each time. Aim for the speed target prescribed and stop the set when your speed drops below the cut-off.', 'Bar speed shows how you are performing on the day, so your training matches your readiness. The numbers only mean something if every rep is a maximum effort.', 18),
  ('wave', 'Wave Loading', array['wave']::text[], 'A short run of sets that gets heavier as the reps drop, then repeats.', 'Example: 3 reps, 2 reps, 1 rep, then start again at 3 reps slightly heavier than the first time. Each run is one wave.', 'The first wave prepares you for the second, so you can often lift a little more.', 19),
  ('metric-app', 'How to use the Metric VBT app', array['metric app','metricvbt']::text[], 'An app that measures your bar speed using your phone camera. In the App Store it is listed as "Metric - Strength Training".
iOS: https://apps.apple.com/us/app/metric-strength-training/id1595510857
Android: https://play.google.com/store/apps/details?id=com.coreadvantage.metric', 'Setup: Put your phone on a tripod or lean it against something stable. Never hold it or have someone film by hand. Keep it upright (portrait), side on to the bar, at roughly bar height. You, the bar and the plates must stay in frame for the whole set, including taking the bar out and putting it back.
Record: Choose your exercise and enter the weight. Tap record, do your set, then tap stop.
After: Check the speed of each rep against your target, then log it as instructed.
Video tutorial: https://www.youtube.com/watch?v=sBhU48y6_Oo', null, 20),
  ('vbt-troubleshooting', 'VBT troubleshooting', array['vbt troubleshooting']::text[], 'First, check the reading is real: Is your phone still, upright and side on, with you, the bar and the plates in frame for the whole set? Avoid bright lights or windows behind the bar, and dark plates in a dark space. If a rep is missing or a number looks way off, re-record before you change anything.', 'If your speed is too slow:
- Check your effort. Every rep should be lifted as fast as you can, to the same depth.
- Take your full rest and try one more set.
- Still slow? Reduce the weight by about 5% and go again.
- Still slow after that? Finish the session at the lighter weight and let me know.
If your speed is too fast: Add about 5% to the weight for your next set.
If you hit the cut-off early: Stop the set there, even if you have reps left on paper. That is the method working, not a failure.', null, 21)
on conflict (key) do nothing;

insert into public.habit_templates (name, details, sort_order) values
  ('Baseline Performance Testing', 'This testing protocol will help provide information that I will use to develop your program and to track progress.
Click the link below to get started and follow the instructions as provided.
https://forms.gle/92wSgVGJdyhe8PCZA
This will roughly take between 45-60 minutes to complete.', 0),
  ('Combat - Weekly Training Volume Log', 'Regularly completing this Training Log will allow us to track the amount of training that you do both in and out of competition so we can better scale and modify your program.
1. Complete the short form below (Sunday night at the latest).
https://forms.gle/tV2GxMPz1f2JEKUc8
2. If you have any training videos or other material that you''d like to submit, send it through in the app chat so we can get back to you during the week.
Please complete this by Sunday night.', 1),
  ('Feedback Form', 'I am constantly striving to bring the best service to my clientele. As a favour could you please fill out this anonymous form below as honestly as possible.
This will help me to further improve on your coaching experience.
https://forms.gle/VLrddBwLTHuZbT9W9
Thank you!', 2),
  ('Movement Break', 'When at work set a timer for every 60 minutes.
Once the timer goes off pick an exercise to perform. Example: Squats, Push Ups, Lunges, Plank, etc.
Start with 10 reps of your selected exercise for each hour.
So by the end of an 8 hour work day you''ll be able to complete 80 squats.
As these get easier you can increase the reps per break.', 3),
  ('Take photos of each meal/snack', 'Take photos of each meal and send it through to me in the app chat.', 4),
  ('Testimonial/Feedback Form', 'I am constantly striving to bring the best service to my clientele and as a business every review/testimonial goes a long way.
As a favour could you please fill out this Testimonial form below as I''d be extremely grateful.
https://forms.gle/VLrddBwLTHuZbT9W9
And if you have extra time, this Google review so more people can learn about my services.
https://g.page/r/CbMUE1XNIOiKEAE/review
Thank you!', 5),
  ('Walk 10,000+ steps every day', 'Find different ways throughout the day to increase your step count!
This can be parking further away from work than you normally do, taking public transport, walking around during your lunch break or when taking a phone call, having a reminder to move every 30 minutes, etc!', 6),
  ('Weekly Check-In', 'Regular check-ins will help to keep you focussed on your goals, and to ensure that I know what is happening in your world so I can help you with any challenges you are facing, celebrate the wins with you and make necessary adjustments to your plan.
1. Complete the short form below (Sunday night at the latest).
2. Message any training videos or other material that you''d like to submit.
3. If you have an aesthetic goal, check if it is time for photos, in which case upload photos, measurements and your weight. Otherwise just update your morning bodyweight.
https://forms.gle/5PQRoTHngAUrjrsG9
Please complete this by Sunday night.', 7)
on conflict (name) do nothing;
