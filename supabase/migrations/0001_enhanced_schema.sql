-- Enhanced schema
create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null check (length(name) >= 1 and length(name) <= 100),
  description text,
  status text default 'In Progress' check (status in ('In Progress','Completed','Failed')),
  ifc_model_path text,
  ifc_file_size bigint,
  ifc_version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists design_inputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  dead_load real not null check (dead_load > 0),
  live_load real not null check (live_load > 0),
  wind_load real not null check (wind_load >= 0),
  concrete_strength integer not null check (concrete_strength > 0 and concrete_strength <= 100),
  rebar_strength integer not null check (rebar_strength > 0 and rebar_strength <= 1000),
  load_combinations jsonb default '[]',
  created_at timestamptz default now(),
  unique(project_id)
);

create table if not exists design_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  results jsonb not null,
  report_path text,
  analysis_duration_seconds real,
  compliance_summary jsonb,
  element_count integer,
  overall_compliance boolean,
  max_utilization real,
  created_at timestamptz default now(),
  unique(project_id)
);

create table if not exists analysis_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  log_level text check (log_level in ('INFO','WARNING','ERROR')),
  message text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- RLS policies
alter table projects enable row level security;
create policy "Users can only access their own projects" on projects
  for all using (auth.uid() = user_id);

alter table design_inputs enable row level security;
create policy "Users can only access their own design inputs" on design_inputs
  for all using (
    exists (
      select 1 from projects p
      where p.id = design_inputs.project_id
        and p.user_id = auth.uid()
    )
  );

alter table design_outputs enable row level security;
create policy "Users can only access their own design outputs" on design_outputs
  for all using (
    exists (
      select 1 from projects p
      where p.id = design_outputs.project_id
        and p.user_id = auth.uid()
    )
  );


