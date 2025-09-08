-- Create private storage buckets by inserting into storage.buckets
insert into storage.buckets (id, name, public)
values ('ifc-models', 'ifc-models', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- Basic policies: authenticated users can read/write objects in these buckets
-- Drop if exist to avoid duplicates on re-run
drop policy if exists "ifc models read" on storage.objects;
create policy "ifc models read" on storage.objects
  for select to authenticated
  using (bucket_id = 'ifc-models');

drop policy if exists "ifc models insert" on storage.objects;
create policy "ifc models insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ifc-models');

drop policy if exists "ifc models update" on storage.objects;
create policy "ifc models update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ifc-models')
  with check (bucket_id = 'ifc-models');

drop policy if exists "ifc models delete" on storage.objects;
create policy "ifc models delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ifc-models');

drop policy if exists "reports read" on storage.objects;
create policy "reports read" on storage.objects
  for select to authenticated
  using (bucket_id = 'reports');

drop policy if exists "reports insert" on storage.objects;
create policy "reports insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reports');

drop policy if exists "reports update" on storage.objects;
create policy "reports update" on storage.objects
  for update to authenticated
  using (bucket_id = 'reports')
  with check (bucket_id = 'reports');

drop policy if exists "reports delete" on storage.objects;
create policy "reports delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reports');


