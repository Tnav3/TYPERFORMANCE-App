-- Organise the exercise library with tags (e.g. lower, unilateral, dumbbell) and remember where an exercise came from.
alter table public.exercises
  add column if not exists tags text[] not null default '{}'
    check (cardinality(tags) <= 8 and array_to_string(tags, '') !~ '[,]'),
  add column if not exists source text check (source is null or length(source) <= 40);
create index if not exists exercises_tags_idx on public.exercises using gin (tags);
