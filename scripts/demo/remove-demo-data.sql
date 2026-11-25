-- Removes the demo data seeded on the TEST project for the "Test" client (tyrell.navarro@hotmail.com).
-- Test project only. Never run on live.
do $$
declare a uuid := '0396b8db-f33f-4b74-9f1b-f78b8003441b';
begin
  delete from workouts where athlete_id = a and notes = 'Demo data';          -- items, logs, sets cascade
  delete from test_entries where athlete_id = a and notes = 'Demo data';
  delete from training_sessions where athlete_id = a and notes = 'Demo data';
  delete from lift_maxes where athlete_id = a and saved_on = date '2026-11-17';
  delete from body_metrics where athlete_id = a and measured_on between date '2026-10-27' and date '2026-11-25';
  delete from weekly_checkins where athlete_id = a and week_start between date '2026-09-28' and date '2026-11-16';
  delete from fights where athlete_id = a;
  delete from titles where athlete_id = a;
  delete from badges where athlete_id = a;
  delete from notifications where user_id = a;
  delete from messages where athlete_id = a;
  delete from habits where athlete_id = a and name in ('3 L water', '8 h sleep', 'Mobility 10 min');
  delete from client_notes where athlete_id = a;
  delete from player_cards where athlete_id = a;
  delete from meal_plans where athlete_id = a and title = 'Fight camp cut';
  delete from meal_library where 'demo' = any(tags);
end $$;
