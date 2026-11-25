-- =====================================================================
-- Migration 078 — daily quotes: real, sourced athlete quotes replace the
-- placeholder TYPERFORMANCE lines. quotes.source records where each was said
-- so the coach can check it (shown on /coach/quotes, not to clients).
-- =====================================================================
alter table public.quotes add column if not exists source text check (source is null or length(source) <= 200);

delete from public.quotes where author = 'TYPERFORMANCE' and created_at < now();

insert into public.quotes (body, author, source) values
  ('Everybody has plans until they get hit for the first time.', 'Mike Tyson',
   'Before the Tyrell Biggs fight, Oct 1987 (traced by Quote Investigator)'),
  ('Discipline is doing what you hate to do, but doing it like you love it.', 'Mike Tyson',
   'Interviews, e.g. Joe Rogan Experience; credits Cus D''Amato'),
  ('I hated every minute of training, but I said, ''Don''t quit. Suffer now and live the rest of your life as a champion.''', 'Muhammad Ali',
   'Sports Illustrated, Sept 1978; quoted by the Muhammad Ali Center'),
  ('The fight is won or lost far away from witnesses, behind the lines, in the gym and out there on the road, long before I dance under those lights.', 'Muhammad Ali',
   'The Greatest: My Own Story (1975)'),
  ('I''ve failed over and over and over again in my life. And that is why I succeed.', 'Michael Jordan',
   'Nike "Failure" ad, 1997'),
  ('100 percent of the shots you don''t take don''t go in.', 'Wayne Gretzky',
   'The Hockey News interview, 1983'),
  ('Friends can come and go, but banners hang forever.', 'Kobe Bryant',
   'ESPN interview with Jemele Hill, 2013');
