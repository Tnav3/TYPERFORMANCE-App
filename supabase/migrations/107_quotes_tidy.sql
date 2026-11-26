-- =====================================================================
-- 107: switch off daily quotes that dwell on losing or on money.
-- Switched off (active = false), not deleted, so the coach can turn any
-- back on from /coach/quotes.
-- =====================================================================
update public.quotes set active = false
where active and body in (
  -- money
  'The question isn''t at what age I want to retire, it''s at what income.',
  'If you look good, you feel good. If you feel good, you play good. If you play good, they pay good.',
  'It''s hard to get up at 5 a.m. when you''re wearing silk pyjamas.',
  -- negative about losing
  'Being second is to be the first of the ones who lose.',
  'Second place is just the first loser.',
  'Victory is fleeting. Losing is forever.',
  'A champion is afraid of losing. Everyone else is afraid of winning.',
  'I hate to lose more than I like to win.',
  'There''s winning and there''s misery.',
  'Show me a good loser, and I''ll show you a loser.',
  'Whoever said ''It''s not whether you win or lose that counts'' probably lost.',
  'You are what your record says you are.',
  'Nice guys finish last.',
  'The only way to prove that you''re a good sport is to lose.',
  'We didn''t lose the game; we just ran out of time.'
);
