-- Deploy Control: esquema multi-tenant; tudo nasce fechado (RLS ligada, nada para anon) e só membros da organização acessam.

-- ============================================================
-- Tipos
-- ============================================================
create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.deploy_environment as enum ('staging', 'production');
create type public.deploy_type as enum ('release', 'hotfix', 'bugfix');

-- ============================================================
-- Tabelas
-- ============================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  jira_base_url text check (jira_base_url ~ '^https://[^\s]+$' and char_length(jira_base_url) <= 200),
  repo_url text check (repo_url ~ '^https://[^\s]+$' and char_length(repo_url) <= 300),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, name),
  -- Permite FK composta (id, org_id): um deploy nunca aponta para projeto de outra organização.
  unique (id, org_id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null check (char_length(file_name) <= 200),
  row_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  code_version text not null check (char_length(btrim(code_version)) between 1 and 120),
  branch text check (char_length(branch) <= 200),
  environment public.deploy_environment not null,
  deployed_on date not null,
  sprint text check (char_length(sprint) <= 60),
  type public.deploy_type not null default 'release',
  source_branch text check (char_length(source_branch) <= 200),
  merged_branches text[] not null default '{}' check (cardinality(merged_branches) <= 50),
  notes text check (char_length(notes) <= 2000),
  import_batch_id uuid,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade,
  foreign key (import_batch_id, org_id) references public.import_batches (id, org_id) on delete cascade
);
create index deployments_org_date_idx on public.deployments (org_id, deployed_on desc);
create index deployments_project_date_idx on public.deployments (project_id, deployed_on desc);
create index deployments_batch_idx on public.deployments (import_batch_id);

create table public.deployment_tasks (
  deployment_id uuid not null,
  org_id uuid not null,
  task_key text not null check (task_key ~ '^[A-Z][A-Z0-9]{1,19}-[0-9]{1,7}$'),
  primary key (deployment_id, task_key),
  foreign key (deployment_id, org_id) references public.deployments (id, org_id) on delete cascade
);
create index deployment_tasks_org_key_idx on public.deployment_tasks (org_id, task_key);

create table public.deployment_pull_requests (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null,
  org_id uuid not null,
  url text not null check (url ~ '^https?://[^\s]+$' and char_length(url) <= 500),
  number integer check (number > 0),
  unique (deployment_id, url),
  foreign key (deployment_id, org_id) references public.deployments (id, org_id) on delete cascade
);
create index deployment_prs_deployment_idx on public.deployment_pull_requests (deployment_id);

create table public.deployment_commits (
  deployment_id uuid not null,
  org_id uuid not null,
  sha text not null check (sha ~ '^[0-9a-f]{7,40}$'),
  cherry_pick boolean not null default false,
  primary key (deployment_id, sha),
  foreign key (deployment_id, org_id) references public.deployments (id, org_id) on delete cascade
);

-- ============================================================
-- Funções auxiliares de acesso (security definer para não cair em recursão de RLS)
-- ============================================================
create function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function public.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

create function public.can_write(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(p_org, array['owner', 'admin', 'member']::public.org_role[]);
$$;

create function public.can_manage(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(p_org, array['owner', 'admin']::public.org_role[]);
$$;

-- Perfil criado automaticamente no cadastro.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger deployments_touch_updated_at
before update on public.deployments
for each row execute function public.touch_updated_at();

-- ============================================================
-- RPCs
-- ============================================================

-- Cria a organização e torna quem chamou o owner (security definer porque ainda não há membership).
create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'Faça login para criar uma organização.' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'Limite de organizações atingido.' using errcode = '54000';
  end if;

  insert into public.organizations (name, created_by) values (btrim(p_name), v_uid) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end;
$$;

-- Insere um deploy e seus filhos. Security invoker: o RLS de cada tabela continua valendo.
create function public._insert_deployment(p_org uuid, p jsonb, p_batch uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.deployments (
    org_id, project_id, code_version, branch, environment, deployed_on, sprint, type,
    source_branch, merged_branches, notes, import_batch_id
  ) values (
    p_org,
    (p ->> 'project_id')::uuid,
    btrim(p ->> 'code_version'),
    nullif(btrim(p ->> 'branch'), ''),
    (p ->> 'environment')::public.deploy_environment,
    (p ->> 'deployed_on')::date,
    nullif(btrim(p ->> 'sprint'), ''),
    coalesce(nullif(p ->> 'type', ''), 'release')::public.deploy_type,
    nullif(btrim(p ->> 'source_branch'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'merged_branches', '[]'::jsonb))), '{}'),
    nullif(btrim(p ->> 'notes'), ''),
    p_batch
  )
  returning id into v_id;

  perform public._insert_deployment_children(v_id, p_org, p);
  return v_id;
end;
$$;

create function public._insert_deployment_children(p_id uuid, p_org uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.deployment_tasks (deployment_id, org_id, task_key)
  select p_id, p_org, t
  from jsonb_array_elements_text(coalesce(p -> 'tasks', '[]'::jsonb)) as t
  on conflict do nothing;

  insert into public.deployment_pull_requests (deployment_id, org_id, url, number)
  select p_id, p_org, x ->> 'url', nullif(x ->> 'number', '')::integer
  from jsonb_array_elements(coalesce(p -> 'pull_requests', '[]'::jsonb)) as x
  on conflict do nothing;

  insert into public.deployment_commits (deployment_id, org_id, sha, cherry_pick)
  select p_id, p_org, lower(x ->> 'sha'), coalesce((x ->> 'cherry_pick')::boolean, false)
  from jsonb_array_elements(coalesce(p -> 'commits', '[]'::jsonb)) as x
  on conflict do nothing;
end;
$$;

-- Cria ou atualiza um deploy de forma atômica.
create function public.save_deployment(p_org uuid, p_id uuid, p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    return public._insert_deployment(p_org, p, null);
  end if;

  update public.deployments set
    project_id = (p ->> 'project_id')::uuid,
    code_version = btrim(p ->> 'code_version'),
    branch = nullif(btrim(p ->> 'branch'), ''),
    environment = (p ->> 'environment')::public.deploy_environment,
    deployed_on = (p ->> 'deployed_on')::date,
    sprint = nullif(btrim(p ->> 'sprint'), ''),
    type = coalesce(nullif(p ->> 'type', ''), 'release')::public.deploy_type,
    source_branch = nullif(btrim(p ->> 'source_branch'), ''),
    merged_branches = coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'merged_branches', '[]'::jsonb))), '{}'),
    notes = nullif(btrim(p ->> 'notes'), '')
  where id = p_id and org_id = p_org
  returning id into v_id;

  if v_id is null then
    raise exception 'Deploy não encontrado.' using errcode = 'P0002';
  end if;

  delete from public.deployment_tasks where deployment_id = v_id;
  delete from public.deployment_pull_requests where deployment_id = v_id;
  delete from public.deployment_commits where deployment_id = v_id;
  perform public._insert_deployment_children(v_id, p_org, p);
  return v_id;
end;
$$;

-- Importa um lote inteiro numa transação só: ou entra tudo, ou nada.
create function public.import_deployments(p_org uuid, p_file_name text, p_rows jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch uuid;
  v_row jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Nenhuma linha para importar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'Máximo de 5000 linhas por importação.' using errcode = '54000';
  end if;

  insert into public.import_batches (org_id, file_name, row_count)
  values (p_org, left(btrim(p_file_name), 200), jsonb_array_length(p_rows))
  returning id into v_batch;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    perform public._insert_deployment(p_org, v_row, v_batch);
  end loop;

  return v_batch;
end;
$$;

-- ============================================================
-- View de insights por task (security_invoker: respeita o RLS de quem consulta)
-- ============================================================
create view public.task_deploy_summary
with (security_invoker = true)
as
select
  t.org_id,
  d.project_id,
  t.task_key,
  min(d.deployed_on) filter (where d.environment = 'staging') as first_staging_on,
  min(d.deployed_on) filter (where d.environment = 'production') as first_production_on,
  count(*) filter (where d.environment = 'staging') as staging_deploys,
  count(*) filter (where d.environment = 'production') as production_deploys,
  max(d.deployed_on) as last_deployed_on
from public.deployment_tasks t
join public.deployments d on d.id = t.deployment_id
group by t.org_id, d.project_id, t.task_key;

create view public.project_deploy_stats
with (security_invoker = true)
as
select
  p.id as project_id,
  p.org_id,
  count(d.id) as deploys,
  count(d.id) filter (where d.environment = 'production') as production_deploys,
  max(d.deployed_on) as last_deployed_on
from public.projects p
left join public.deployments d on d.project_id = p.id
group by p.id, p.org_id;

-- ============================================================
-- RLS
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.import_batches enable row level security;
alter table public.deployments enable row level security;
alter table public.deployment_tasks enable row level security;
alter table public.deployment_pull_requests enable row level security;
alter table public.deployment_commits enable row level security;

create policy "membros veem a organização" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "owner/admin editam a organização" on public.organizations
  for update to authenticated using (public.can_manage(id)) with check (public.can_manage(id));

create policy "cada um vê o próprio perfil e o de colegas" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.org_id = mine.org_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "membros veem os membros" on public.memberships
  for select to authenticated using (public.is_org_member(org_id));

create policy "membros veem projetos" on public.projects
  for select to authenticated using (public.is_org_member(org_id));
create policy "owner/admin criam projetos" on public.projects
  for insert to authenticated with check (public.can_manage(org_id));
create policy "owner/admin editam projetos" on public.projects
  for update to authenticated using (public.can_manage(org_id)) with check (public.can_manage(org_id));
create policy "owner/admin apagam projetos" on public.projects
  for delete to authenticated using (public.can_manage(org_id));

create policy "membros veem importações" on public.import_batches
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve cria importações" on public.import_batches
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve desfaz importações" on public.import_batches
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem deploys" on public.deployments
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve cria deploys" on public.deployments
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve edita deploys" on public.deployments
  for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "quem escreve apaga deploys" on public.deployments
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem tasks" on public.deployment_tasks
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve grava tasks" on public.deployment_tasks
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve apaga tasks" on public.deployment_tasks
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem PRs" on public.deployment_pull_requests
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve grava PRs" on public.deployment_pull_requests
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve apaga PRs" on public.deployment_pull_requests
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem commits" on public.deployment_commits
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve grava commits" on public.deployment_commits
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve apaga commits" on public.deployment_commits
  for delete to authenticated using (public.can_write(org_id));

-- ============================================================
-- Grants explícitos ("Automatically expose new tables" está desligado)
-- anon não recebe nada; authenticated só o que as policies permitem usar.
-- ============================================================
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.import_batches to authenticated;
grant select, insert, update, delete on public.deployments to authenticated;
grant select, insert, delete on public.deployment_tasks to authenticated;
grant select, insert, delete on public.deployment_pull_requests to authenticated;
grant select, insert, delete on public.deployment_commits to authenticated;
grant select on public.task_deploy_summary to authenticated;
grant select on public.project_deploy_stats to authenticated;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;
grant execute on function public.can_write(uuid) to authenticated;
grant execute on function public.can_manage(uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public._insert_deployment(uuid, jsonb, uuid) to authenticated;
grant execute on function public._insert_deployment_children(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_deployment(uuid, uuid, jsonb) to authenticated;
grant execute on function public.import_deployments(uuid, text, jsonb) to authenticated;
