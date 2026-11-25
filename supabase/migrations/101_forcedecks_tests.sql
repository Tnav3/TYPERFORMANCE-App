-- The full ForceDecks catalogue, so the coach can pick which tests a testing day uses.
insert into public.test_definitions (key, name, mode, sort_order, instructions) values
  ('abcmj', 'Abalakov jump (ForceDecks)', 'forcedecks', 201, E'Countermovement jump with a free arm swing.\n3 jumps, about 30 s between. Record the best jump height.'),
  ('lcmj', 'Loaded CMJ (ForceDecks)', 'forcedecks', 202, E'Countermovement jump holding the prescribed load (bar or dumbbells).\n3 jumps. Record the best jump height and the load.'),
  ('cmrj', 'CMJ rebound (ForceDecks)', 'forcedecks', 203, E'Countermovement jump, land and rebound straight into a second jump.\n3 attempts. Record the best rebound jump height and RSI.'),
  ('sj', 'Squat jump (ForceDecks)', 'forcedecks', 204, E'Hands on hips. Sink to a half squat, hold still for 2-3 s, then jump with no dip.\n3 jumps. Record the best jump height.'),
  ('lsj', 'Loaded squat jump (ForceDecks)', 'forcedecks', 205, E'Squat jump holding the prescribed load. Pause 2-3 s in the half squat, no dip.\n3 jumps. Record the best jump height and the load.'),
  ('slcmrj', 'Single leg rebound jump (ForceDecks)', 'forcedecks', 206, E'Single leg countermovement jump, rebounding into a second jump on the same leg.\n3 each side. Record the best height for each leg.'),
  ('dj', 'Drop jump (ForceDecks)', 'forcedecks', 207, E'Hands on hips. Step off the box, land on both plates and jump as high and fast as possible.\n3 attempts. Record box height, best RSI, jump height and contact time.'),
  ('sldj', 'Single leg drop jump (ForceDecks)', 'forcedecks', 208, E'Step off the box onto one leg and jump straight up as fast as possible.\n3 each side. Record box height and the best RSI per leg.'),
  ('hj', 'Hop test (ForceDecks)', 'forcedecks', 209, E'Hands on hips. Repeated stiff-legged hops, as high and fast as possible.\nRecord the best RSI and contact time.'),
  ('slhj', 'Single leg hop test (ForceDecks)', 'forcedecks', 210, E'Repeated hops on one leg, as high and fast as possible.\nRecord the best RSI for each leg.'),
  ('slhar', 'Single leg hop and return (ForceDecks)', 'forcedecks', 211, E'Hop off the plate onto one leg and straight back on.\n3 each side. Record the best RSI for each leg.'),
  ('lah', 'Land and hold (ForceDecks)', 'forcedecks', 212, E'Drop from the box and stick the landing on both legs, holding still.\n3 attempts. Record peak landing force (× bodyweight) and time to stabilise.'),
  ('sllah', 'Single leg land and hold (ForceDecks)', 'forcedecks', 213, E'Drop from the box onto one leg and stick the landing.\n3 each side. Record peak landing force (× bodyweight) per leg.'),
  ('sqt', 'Squat assessment (ForceDecks)', 'forcedecks', 214, E'5 bodyweight squats to a comfortable depth at a steady tempo.\nRecord left-right asymmetry and depth.'),
  ('iso_squat', 'Isometric squat (ForceDecks)', 'forcedecks', 215, E'Bar fixed at the set squat depth. Push as hard and fast as possible for 3-5 s.\n2-3 attempts. Record the best peak force.'),
  ('iso_belt_squat', 'Isometric belt squat (ForceDecks)', 'forcedecks', 216, E'Belt squat fixed at the set depth. Push as hard and fast as possible for 3-5 s.\n2-3 attempts. Record the best peak force.'),
  ('iso_hamstring', 'Single leg hamstring isometric (ForceDecks)', 'forcedecks', 217, E'Lying on your back, heel on the plate at the set knee angle. Drive the heel down as hard as possible for 3 s.\n3 each side. Record peak force per leg.'),
  ('iso_pushup', 'Isometric push-up (ForceDecks)', 'forcedecks', 218, E'Hands on the plates at the set elbow angle. Push as hard as possible for 3 s.\n2-3 attempts. Record the best peak force.'),
  ('ash', 'Athletic shoulder test (ForceDecks)', 'forcedecks', 219, E'Lying face down, hand on the plate, arm in I, then Y, then T. Push down as hard as possible for 3 s.\n3 each position, each side. Record peak force for each.'),
  ('quiet_stand', 'Quiet stand (ForceDecks)', 'forcedecks', 220, E'Stand still on both plates, eyes open (or as set), for 30 s.\nRecord the sway area. Lower is better.'),
  ('sl_stand', 'Single leg stand (ForceDecks)', 'forcedecks', 221, E'Stand on one leg on the plate for 20-30 s.\nRecord the sway area for each leg. Lower is better.')
on conflict (key) do nothing;
