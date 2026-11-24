-- =====================================================================
-- Migration 059 — program folders with subfolders
--   e.g. Weight loss › Beginner, Combat sports › Peaking, Protocols › Injury & rehab.
-- =====================================================================
create table public.program_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  parent_id   uuid references public.program_folders(id) on delete cascade,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index program_folders_parent_idx on public.program_folders (parent_id, sort_order, name);
alter table public.program_folders enable row level security;
create policy "program_folders_coach" on public.program_folders for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- No loops (a folder inside itself) and at most 4 levels deep.
create or replace function public.guard_program_folder()
returns trigger language plpgsql set search_path = public as $$
declare cur uuid := new.parent_id; depth int := 1;
begin
  while cur is not null loop
    if cur = new.id then raise exception 'A folder can''t go inside itself'; end if;
    depth := depth + 1;
    if depth > 4 then raise exception 'Folders can only go 4 levels deep'; end if;
    select parent_id into cur from program_folders where id = cur;
  end loop;
  return new;
end;
$$;
create trigger guard_program_folder before insert or update of parent_id on public.program_folders
  for each row execute function public.guard_program_folder();

-- Deleting a folder keeps its programs: they move up to the top level.
alter table public.programs add column if not exists folder_id uuid references public.program_folders(id) on delete set null;
create index if not exists programs_folder_idx on public.programs (folder_id);

-- Starter folders (rename or delete freely)
do $$
declare wl uuid; cs uuid; pr uuid;
begin
  insert into program_folders (name, sort_order) values ('Combat sports', 1) returning id into cs;
  insert into program_folders (name, parent_id, sort_order) values ('Off-season', cs, 1), ('Fight camp', cs, 2), ('Peaking', cs, 3);
  insert into program_folders (name, sort_order) values ('Weight loss', 2) returning id into wl;
  insert into program_folders (name, parent_id, sort_order) values ('Beginner', wl, 1), ('Intermediate', wl, 2);
  insert into program_folders (name, sort_order) values ('Protocols', 3) returning id into pr;
  insert into program_folders (name, parent_id, sort_order) values ('Injury & rehab', pr, 1), ('Hot/cold contrast', pr, 2), ('Recovery', pr, 3);
end $$;
