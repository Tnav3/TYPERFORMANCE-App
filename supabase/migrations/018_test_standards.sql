-- =====================================================================
-- TYPERFORMANCE Training Load App
-- Migration 018 — Bronze / Silver / Gold testing standards (by sex) + profile sex
-- Coach-editable. Seeded only where published combat-sport data exists.
-- =====================================================================

alter table public.profiles
  add column if not exists sex text check (sex in ('male', 'female'));

create table public.test_standards (
  test_key   text not null references public.test_definitions(key) on delete cascade,
  sex        text not null check (sex in ('male', 'female')),
  bronze     numeric(8,2) check (bronze > 0),
  silver     numeric(8,2) check (silver > 0),
  gold       numeric(8,2) check (gold > 0),
  source     text check (source is null or length(source) <= 500),
  updated_at timestamptz not null default now(),
  primary key (test_key, sex),
  check (bronze is null or silver is null or bronze < silver),
  check (silver is null or gold is null or silver < gold),
  check (bronze is null or gold is null or bronze < gold)
);

alter table public.test_standards enable row level security;
create policy "test_standards_read" on public.test_standards
  for select to authenticated using (true);
create policy "test_standards_coach_write" on public.test_standards
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Seed: Bronze ≈ lower-level / national-level mean, Silver ≈ higher-level mean,
-- Gold ≈ elite or higher-level mean + 1 SD.
insert into public.test_standards (test_key, sex, bronze, silver, gold, source) values
  ('box_squat_3rm', 'male', 1.55, 1.85, 2.05,
   'Back-squat 1RM ÷ BW in male MMA: lower-level 1.56 ± 0.24, higher-level 1.84 ± 0.23 (James et al. 2016, IJSPP). Gold = higher-level + 1 SD. Back-squat data applied to the box squat.'),
  ('bench_3rm', 'male', 1.00, 1.20, 1.50,
   'Bench 1RM ÷ BW in male MMA: national/regional ≈ 1.0 (review, PMC6628448), higher-level 1.2 (James et al. 2016), elite heavyweights 1.5 ± 0.2 (Andreato/MDPI 2022).'),
  ('cmj', 'male', 31, 36, 41,
   'CMJ height, male national-team boxers 36.0 ± 4.6 cm (Haugen et al. 2021). Bronze/Gold = mean ∓ 1 SD.'),
  ('cmj', 'female', 22, 25, 28,
   'CMJ height, female national-team boxers 25.1 ± 3.0 cm (Haugen et al. 2021). Bronze/Gold = mean ∓ 1 SD.')
on conflict (test_key, sex) do nothing;
