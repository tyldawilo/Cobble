-- Auto-set projects.user_id from auth.uid() on insert when not provided
create or replace function public.set_projects_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_projects_user_id on public.projects;
create trigger set_projects_user_id
before insert on public.projects
for each row execute function public.set_projects_user_id();

-- Ensure RLS policy exists for inserts
drop policy if exists "Projects insert check user" on projects;
create policy "Projects insert check user" on projects
  for insert
  with check (auth.uid() = user_id);

