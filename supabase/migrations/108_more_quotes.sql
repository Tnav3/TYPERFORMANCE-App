-- =====================================================================
-- 108: 36 more daily quotes, so 365 are switched on (one for every day).
-- Leans to combat sports, martial arts and strength coaching. Most are widely
-- credited but not pinned to a dated source, and are marked that way so the
-- coach can check or switch them off on /coach/quotes.
-- Skips any quote whose text is already in the table.
-- =====================================================================
insert into public.quotes (body, author, source)
select v.body, v.author, v.source from (values
  ('Precision beats power, and timing beats speed.', 'Conor McGregor', 'Commonly attributed; not traced to a dated source'),
  ('Before you can win, you have to believe you are worthy.', 'Georges St-Pierre', 'Commonly attributed; not traced to a dated source'),
  ('Always assume that your opponent is going to be bigger, stronger and faster than you, so that you learn to rely on technique, timing and leverage rather than brute strength.', 'Helio Gracie', 'Commonly attributed; not traced to a dated source'),
  ('Flow with the go.', 'Rickson Gracie', 'Commonly attributed; not traced to a dated source'),
  ('There is no losing in jiu-jitsu. You either win or you learn.', 'Carlos Gracie Jr.', 'Commonly attributed; not traced to a dated source'),
  ('Champions aren''t made in the ring, they are merely recognised there.', 'Joe Frazier', 'Commonly attributed; not traced to a dated source'),
  ('Only a man who knows what it is like to be defeated can reach down to the bottom of his soul and come up with the extra ounce of power it takes to win when the match is even.', 'Muhammad Ali', 'Commonly attributed; not traced to a dated source'),
  ('Be happy, but never satisfied.', 'Bruce Lee', 'Commonly attributed; not traced to a dated source'),
  ('Always be yourself, express yourself, have faith in yourself.', 'Bruce Lee', 'Commonly attributed; not traced to a dated source'),
  ('If you spend too much time thinking about a thing, you''ll never get it done.', 'Bruce Lee', 'Commonly attributed; not traced to a dated source'),
  ('Notice that the stiffest tree is most easily cracked, while the bamboo or willow survives by bending with the wind.', 'Bruce Lee', 'Commonly attributed; not traced to a dated source'),
  ('Knowledge will give you power, but character respect.', 'Bruce Lee', 'Commonly attributed; not traced to a dated source'),
  ('Karate is like boiling water: if you do not heat it constantly, it will cool.', 'Gichin Funakoshi', 'Commonly attributed; not traced to a dated source'),
  ('Failure is the key to success; each mistake teaches us something.', 'Morihei Ueshiba', 'Commonly attributed; not traced to a dated source'),
  ('Perceive that which cannot be seen with the eye.', 'Miyamoto Musashi', 'Commonly attributed to The Book of Five Rings; wording varies by translation'),
  ('Nothing under the sun is greater than education.', 'Jigoro Kano', 'Commonly attributed; not traced to a dated source'),
  ('Discipline equals freedom.', 'Jocko Willink', 'Title of his book Discipline Equals Freedom: Field Manual (2017)'),
  ('Stay hard.', 'David Goggins', 'His catchphrase'),
  ('Strong people are harder to kill than weak people, and more useful in general.', 'Mark Rippetoe', 'Commonly attributed; not traced to a dated source'),
  ('If it''s important, do it every day. If it''s not important, don''t do it at all.', 'Dan John', 'Commonly attributed; not traced to a dated source'),
  ('The goal is to keep the goal the goal.', 'Dan John', 'Commonly attributed; not traced to a dated source'),
  ('Strength is a skill.', 'Pavel Tsatsouline', 'Commonly attributed; not traced to a dated source'),
  ('First move well, then move often.', 'Gray Cook', 'Commonly attributed; not traced to a dated source'),
  ('For me, life is continuously being hungry. The meaning of life is not simply to exist, to survive, but to move ahead, to go up, to conquer.', 'Arnold Schwarzenegger', 'Commonly attributed; not traced to a dated source'),
  ('Everybody pities the weak; jealousy you have to earn.', 'Arnold Schwarzenegger', 'Commonly attributed; not traced to a dated source'),
  ('The resistance that you fight physically in the gym and the resistance that you fight in life can only build a strong character.', 'Arnold Schwarzenegger', 'Commonly attributed; not traced to a dated source'),
  ('Success isn''t always about greatness. It''s about consistency. Consistent hard work leads to success. Greatness will come.', 'Dwayne Johnson', 'Commonly attributed; not traced to a dated source'),
  ('The most important thing is to try and inspire people so that they can be great in whatever they want to do.', 'Kobe Bryant', 'Commonly attributed; not traced to a dated source'),
  ('The triumph can''t be had without the struggle.', 'Wilma Rudolph', 'Commonly attributed; not traced to a dated source'),
  ('I play each point like my life depends on it.', 'Rafael Nadal', 'Commonly attributed; not traced to a dated source'),
  ('I fear no one, but respect everyone.', 'Roger Federer', 'Commonly attributed; not traced to a dated source'),
  ('It''s not about the legs, it''s about the heart and mind.', 'Eliud Kipchoge', 'Commonly attributed; not traced to a dated source'),
  ('The only place success comes before work is in the dictionary.', 'Vince Lombardi', 'Commonly attributed; not traced to a dated source'),
  ('Always make a total effort, even when the odds are against you.', 'Arnold Palmer', 'Commonly attributed; not traced to a dated source'),
  ('I''m not concerned with your liking or disliking me. All I ask is that you respect me as a human being.', 'Jackie Robinson', 'Commonly attributed; not traced to a dated source'),
  ('Somewhere behind the athlete you''ve become and the hours of practice and the coaches who have pushed you is a little girl who fell in love with the game and never looked back. Play for her.', 'Mia Hamm', 'Commonly attributed; not traced to a dated source')
) as v(body, author, source)
where not exists (select 1 from public.quotes q where lower(q.body) = lower(v.body));
