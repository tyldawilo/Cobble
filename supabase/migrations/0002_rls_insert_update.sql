-- RLS: explicit WITH CHECK for inserts and tightened updates

-- Projects: ensure users can only insert/update their own rows
drop policy if exists "Projects insert check user" on projects;
create policy "Projects insert check user" on projects
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Projects update own rows" on projects;
create policy "Projects update own rows" on projects
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Design inputs: insert/update only when owning project
drop policy if exists "Design inputs insert check via project" on design_inputs;
create policy "Design inputs insert check via project" on design_inputs
  for insert
  with check (
    exists (
      select 1 from projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Design inputs update own via project" on design_inputs;
create policy "Design inputs update own via project" on design_inputs
  for update using (
    exists (
      select 1 from projects p
      where p.id = design_inputs.project_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = design_inputs.project_id and p.user_id = auth.uid()
    )
  );

-- Design outputs: insert/update only when owning project
drop policy if exists "Design outputs insert check via project" on design_outputs;
create policy "Design outputs insert check via project" on design_outputs
  for insert
  with check (
    exists (
      select 1 from projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Design outputs update own via project" on design_outputs;
create policy "Design outputs update own via project" on design_outputs
  for update using (
    exists (
      select 1 from projects p
      where p.id = design_outputs.project_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = design_outputs.project_id and p.user_id = auth.uid()
    )
  );


