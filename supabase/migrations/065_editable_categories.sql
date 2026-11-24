-- =====================================================================
-- Migration 065 — the coach can add and rename exercise categories and
-- subcategories (e.g. Conditioning & mobility › Flexibility). The fixed
-- lists from 056 move into two tables; exercises point at them.
-- =====================================================================
create table public.exercise_categories (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,29}$'),
  label      text not null check (length(btrim(label)) between 1 and 40),
  sort_order int not null default 0
);
create table public.exercise_subcategories (
  category   text not null references public.exercise_categories(key) on delete cascade,
  key        text not null check (key ~ '^[a-z][a-z0-9_]{1,29}$'),
  label      text not null check (length(btrim(label)) between 1 and 40),
  sort_order int not null default 0,
  primary key (category, key)
);
alter table public.exercise_categories enable row level security;
alter table public.exercise_subcategories enable row level security;
create policy "ex_cats_read" on public.exercise_categories for select to authenticated using (true);
create policy "ex_cats_coach" on public.exercise_categories for all to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "ex_subs_read" on public.exercise_subcategories for select to authenticated using (true);
create policy "ex_subs_coach" on public.exercise_subcategories for all to authenticated using (public.is_coach()) with check (public.is_coach());

insert into public.exercise_categories (key, label, sort_order) values
  ('knee', 'Knee dominant', 1),
  ('hip', 'Hip dominant', 2),
  ('h_press', 'Horizontal press', 3),
  ('v_press', 'Vertical press', 4),
  ('h_pull', 'Horizontal pull', 5),
  ('v_pull', 'Vertical pull', 6),
  ('ballistic', 'Ballistics', 7),
  ('core', 'Core', 8),
  ('accessory', 'Accessory', 9),
  ('cond_mob', 'Conditioning & mobility', 10)
on conflict (key) do nothing;
insert into public.exercise_subcategories (category, key, label, sort_order) values
  ('knee', 'squat', 'Squat', 1),
  ('knee', 'lunge', 'Lunge / split squat', 2),
  ('knee', 'step_up', 'Step-up', 3),
  ('knee', 'single_leg', 'Single-leg', 4),
  ('hip', 'hinge', 'Hinge / deadlift', 1),
  ('hip', 'thrust', 'Bridge / thrust', 2),
  ('hip', 'curl', 'Hamstring curl', 3),
  ('hip', 'single_leg', 'Single-leg', 4),
  ('h_press', 'barbell', 'Barbell', 1),
  ('h_press', 'dumbbell', 'Dumbbell & cable', 2),
  ('h_press', 'push_up', 'Push-up & dip', 3),
  ('v_press', 'barbell', 'Barbell', 1),
  ('v_press', 'dumbbell', 'Dumbbell & kettlebell', 2),
  ('v_press', 'landmine', 'Landmine', 3),
  ('h_pull', 'rows', 'Rows', 1),
  ('v_pull', 'pull_up', 'Pull-up / chin-up', 1),
  ('v_pull', 'pulldown', 'Pulldown', 2),
  ('ballistic', 'jumps', 'Jumps', 1),
  ('ballistic', 'bounds', 'Bounds & hops', 2),
  ('ballistic', 'throw_rot', 'Throws: rotation', 3),
  ('ballistic', 'throw_oh', 'Throws: overhead & slam', 4),
  ('ballistic', 'throw_chest', 'Throws: chest', 5),
  ('ballistic', 'olympic', 'Olympic lifts', 6),
  ('ballistic', 'upper', 'Upper-body plyo', 7),
  ('core', 'anti_ext', 'Anti-extension', 1),
  ('core', 'anti_rot', 'Anti-rotation', 2),
  ('core', 'rotation', 'Rotation', 3),
  ('core', 'lateral', 'Lateral', 4),
  ('core', 'flexion', 'Flexion', 5),
  ('accessory', 'arms', 'Arms', 1),
  ('accessory', 'shoulders', 'Shoulders', 2),
  ('accessory', 'calves', 'Calves & feet', 3),
  ('accessory', 'neck', 'Neck', 4),
  ('accessory', 'grip', 'Grip & carries', 5),
  ('accessory', 'hips', 'Hips & adductors', 6),
  ('cond_mob', 'conditioning', 'Conditioning', 1),
  ('cond_mob', 'stretch', 'Stretch', 2),
  ('cond_mob', 'soft_tissue', 'Soft tissue', 3),
  ('cond_mob', 'activation', 'Activation & mobility', 4)
on conflict do nothing;

do $$ begin
  execute 'alter table public.exercises drop constraint if exists exercises_category_check';
  execute 'alter table public.exercises drop constraint if exists exercises_subcategory_check';
end $$;
alter table public.exercises add constraint exercises_category_fk foreign key (category) references public.exercise_categories(key) on update cascade;
alter table public.exercises add constraint exercises_subcategory_fk foreign key (category, subcategory)
  references public.exercise_subcategories(category, key) on update cascade;

create or replace function public.exercise_autosort()
returns trigger language plpgsql set search_path = public as $$
declare c text[];
begin
  if not exists (select 1 from exercise_categories where key = new.category) then
    c := public.classify_exercise(new.name, new.tags, new.category);
    new.category := c[1];
    new.subcategory := coalesce(new.subcategory, c[2]);
  else
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
