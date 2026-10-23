-- PR e commit passam a existir por projeto, ligados a tasks (muitos-para-muitos); o deploy só aponta para eles.

-- ============================================================
-- PRs e commits do projeto
-- ============================================================
create table public.pull_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  url text not null check (url ~ '^https?://[^\s]+$' and char_length(url) <= 500),
  number integer check (number > 0),
  description text check (char_length(description) <= 300),
  -- true = marcado explicitamente como "sem task"; false sem tasks ligadas = ainda a vincular.
  no_task boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, url),
  unique (id, org_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);

create table public.pull_request_tasks (
  pull_request_id uuid not null,
  org_id uuid not null,
  task_key text not null check (task_key ~ '^[A-Z][A-Z0-9]{1,19}-[0-9]{1,7}$'),
  primary key (pull_request_id, task_key),
  foreign key (pull_request_id, org_id) references public.pull_requests (id, org_id) on delete cascade
);
create index pull_request_tasks_org_key_idx on public.pull_request_tasks (org_id, task_key);

create table public.commits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  sha text not null check (sha ~ '^[0-9a-f]{7,40}$'),
  description text check (char_length(description) <= 300),
  no_task boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, sha),
  unique (id, org_id),
  foreign key (project_id, org_id) references public.projects (id, org_id) on delete cascade
);

create table public.commit_tasks (
  commit_id uuid not null,
  org_id uuid not null,
  task_key text not null check (task_key ~ '^[A-Z][A-Z0-9]{1,19}-[0-9]{1,7}$'),
  primary key (commit_id, task_key),
  foreign key (commit_id, org_id) references public.commits (id, org_id) on delete cascade
);
create index commit_tasks_org_key_idx on public.commit_tasks (org_id, task_key);

-- ============================================================
-- Troca das tabelas de ligação do deploy, preservando o que já existe
-- ============================================================
create temporary table tmp_prs as
select l.deployment_id, l.org_id, d.project_id, l.url, l.number
from public.deployment_pull_requests l
join public.deployments d on d.id = l.deployment_id;

create temporary table tmp_commits as
select l.deployment_id, l.org_id, d.project_id, l.sha, l.cherry_pick
from public.deployment_commits l
join public.deployments d on d.id = l.deployment_id;

drop table public.deployment_pull_requests;
drop table public.deployment_commits;

create table public.deployment_pull_requests (
  deployment_id uuid not null,
  org_id uuid not null,
  pull_request_id uuid not null,
  primary key (deployment_id, pull_request_id),
  foreign key (deployment_id, org_id) references public.deployments (id, org_id) on delete cascade,
  foreign key (pull_request_id, org_id) references public.pull_requests (id, org_id) on delete cascade
);
create index deployment_pull_requests_pr_idx on public.deployment_pull_requests (pull_request_id);

create table public.deployment_commits (
  deployment_id uuid not null,
  org_id uuid not null,
  commit_id uuid not null,
  cherry_pick boolean not null default false,
  primary key (deployment_id, commit_id),
  foreign key (deployment_id, org_id) references public.deployments (id, org_id) on delete cascade,
  foreign key (commit_id, org_id) references public.commits (id, org_id) on delete cascade
);
create index deployment_commits_commit_idx on public.deployment_commits (commit_id);

insert into public.pull_requests (org_id, project_id, url, number)
select distinct on (project_id, url) org_id, project_id, url, number
from tmp_prs
order by project_id, url;

insert into public.deployment_pull_requests (deployment_id, org_id, pull_request_id)
select t.deployment_id, t.org_id, p.id
from tmp_prs t
join public.pull_requests p on p.project_id = t.project_id and p.url = t.url
on conflict do nothing;

insert into public.commits (org_id, project_id, sha)
select distinct on (project_id, sha) org_id, project_id, sha
from tmp_commits
order by project_id, sha;

insert into public.deployment_commits (deployment_id, org_id, commit_id, cherry_pick)
select t.deployment_id, t.org_id, c.id, t.cherry_pick
from tmp_commits t
join public.commits c on c.project_id = t.project_id and c.sha = t.sha
on conflict do nothing;

drop table tmp_prs;
drop table tmp_commits;

-- ============================================================
-- Gravação dos filhos do deploy: link_mode "replace" (formulário) redefine as tasks do PR; "merge" (importação) só acrescenta.
-- ============================================================
create or replace function public._insert_deployment_children(p_id uuid, p_org uuid, p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid := (p ->> 'project_id')::uuid;
  v_replace boolean := coalesce(p ->> 'link_mode', 'replace') = 'replace';
  v_item jsonb;
  v_ref uuid;
  v_tasks text[];
  v_no_task boolean;
begin
  insert into public.deployment_tasks (deployment_id, org_id, task_key)
  select p_id, p_org, t
  from jsonb_array_elements_text(coalesce(p -> 'tasks', '[]'::jsonb)) as t
  on conflict do nothing;

  for v_item in select value from jsonb_array_elements(coalesce(p -> 'pull_requests', '[]'::jsonb)) loop
    v_tasks := array(select jsonb_array_elements_text(coalesce(v_item -> 'tasks', '[]'::jsonb)));
    v_no_task := cardinality(v_tasks) = 0 and coalesce((v_item ->> 'no_task')::boolean, false);

    insert into public.pull_requests as pr (org_id, project_id, url, number, description, no_task)
    values (p_org, v_project, v_item ->> 'url', nullif(v_item ->> 'number', '')::integer, nullif(btrim(v_item ->> 'description'), ''), v_no_task)
    on conflict (project_id, url) do update set
      number = coalesce(excluded.number, pr.number),
      description = case when v_replace then excluded.description else coalesce(pr.description, excluded.description) end,
      no_task = case when v_replace then excluded.no_task else pr.no_task or excluded.no_task end
    returning id into v_ref;

    if v_replace then
      delete from public.pull_request_tasks where pull_request_id = v_ref;
    end if;
    insert into public.pull_request_tasks (pull_request_id, org_id, task_key)
    select v_ref, p_org, t from unnest(v_tasks) as t
    on conflict do nothing;
    update public.pull_requests set no_task = false
    where id = v_ref and no_task and exists (select 1 from public.pull_request_tasks where pull_request_id = v_ref);

    insert into public.deployment_pull_requests (deployment_id, org_id, pull_request_id)
    values (p_id, p_org, v_ref)
    on conflict do nothing;
    insert into public.deployment_tasks (deployment_id, org_id, task_key)
    select p_id, p_org, t from unnest(v_tasks) as t
    on conflict do nothing;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p -> 'commits', '[]'::jsonb)) loop
    v_tasks := array(select jsonb_array_elements_text(coalesce(v_item -> 'tasks', '[]'::jsonb)));
    v_no_task := cardinality(v_tasks) = 0 and coalesce((v_item ->> 'no_task')::boolean, false);

    insert into public.commits as c (org_id, project_id, sha, description, no_task)
    values (p_org, v_project, lower(v_item ->> 'sha'), nullif(btrim(v_item ->> 'description'), ''), v_no_task)
    on conflict (project_id, sha) do update set
      description = case when v_replace then excluded.description else coalesce(c.description, excluded.description) end,
      no_task = case when v_replace then excluded.no_task else c.no_task or excluded.no_task end
    returning id into v_ref;

    if v_replace then
      delete from public.commit_tasks where commit_id = v_ref;
    end if;
    insert into public.commit_tasks (commit_id, org_id, task_key)
    select v_ref, p_org, t from unnest(v_tasks) as t
    on conflict do nothing;
    update public.commits set no_task = false
    where id = v_ref and no_task and exists (select 1 from public.commit_tasks where commit_id = v_ref);

    insert into public.deployment_commits (deployment_id, org_id, commit_id, cherry_pick)
    values (p_id, p_org, v_ref, coalesce((v_item ->> 'cherry_pick')::boolean, false))
    on conflict do nothing;
    insert into public.deployment_tasks (deployment_id, org_id, task_key)
    select p_id, p_org, t from unnest(v_tasks) as t
    on conflict do nothing;
  end loop;
end;
$$;

-- Liga (ou marca como sem task) um PR já existente, pela tela de vínculo.
create function public.link_pull_request(p_id uuid, p_tasks text[], p_no_task boolean, p_description text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_deploy uuid;
begin
  select org_id into v_org from public.pull_requests where id = p_id;
  if v_org is null then
    raise exception 'PR não encontrado.' using errcode = 'P0002';
  end if;

  update public.pull_requests
  set no_task = coalesce(cardinality(p_tasks), 0) = 0 and p_no_task,
      description = coalesce(nullif(btrim(p_description), ''), description)
  where id = p_id;

  delete from public.pull_request_tasks where pull_request_id = p_id;
  insert into public.pull_request_tasks (pull_request_id, org_id, task_key)
  select p_id, v_org, t from unnest(coalesce(p_tasks, '{}')) as t
  on conflict do nothing;

  -- As tasks do PR passam a constar em todos os deploys em que ele subiu.
  for v_deploy in select deployment_id from public.deployment_pull_requests where pull_request_id = p_id loop
    insert into public.deployment_tasks (deployment_id, org_id, task_key)
    select v_deploy, v_org, t from unnest(coalesce(p_tasks, '{}')) as t
    on conflict do nothing;
  end loop;
end;
$$;

-- Mesmo que link_pull_request, para commit avulso.
create function public.link_commit(p_id uuid, p_tasks text[], p_no_task boolean, p_description text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_deploy uuid;
begin
  select org_id into v_org from public.commits where id = p_id;
  if v_org is null then
    raise exception 'Commit não encontrado.' using errcode = 'P0002';
  end if;

  update public.commits
  set no_task = coalesce(cardinality(p_tasks), 0) = 0 and p_no_task,
      description = coalesce(nullif(btrim(p_description), ''), description)
  where id = p_id;

  delete from public.commit_tasks where commit_id = p_id;
  insert into public.commit_tasks (commit_id, org_id, task_key)
  select p_id, v_org, t from unnest(coalesce(p_tasks, '{}')) as t
  on conflict do nothing;

  for v_deploy in select deployment_id from public.deployment_commits where commit_id = p_id loop
    insert into public.deployment_tasks (deployment_id, org_id, task_key)
    select v_deploy, v_org, t from unnest(coalesce(p_tasks, '{}')) as t
    on conflict do nothing;
  end loop;
end;
$$;

-- ============================================================
-- Resumo por PR (security_invoker: respeita o RLS de quem consulta)
-- ============================================================
create view public.pull_request_summary
with (security_invoker = true)
as
select
  pr.id,
  pr.org_id,
  pr.project_id,
  pr.url,
  pr.number,
  pr.description,
  pr.no_task,
  coalesce((select array_agg(t.task_key order by t.task_key) from public.pull_request_tasks t where t.pull_request_id = pr.id), '{}') as tasks,
  case
    when exists (select 1 from public.pull_request_tasks t where t.pull_request_id = pr.id) then 'linked'
    when pr.no_task then 'no_task'
    else 'pending'
  end as link_status,
  min(d.deployed_on) filter (where d.environment = 'staging') as first_staging_on,
  min(d.deployed_on) filter (where d.environment = 'production') as first_production_on,
  count(d.id) filter (where d.environment = 'staging') as staging_deploys,
  count(d.id) filter (where d.environment = 'production') as production_deploys,
  max(d.deployed_on) as last_deployed_on
from public.pull_requests pr
left join public.deployment_pull_requests dp on dp.pull_request_id = pr.id
left join public.deployments d on d.id = dp.deployment_id
group by pr.id;

create view public.commit_summary
with (security_invoker = true)
as
select
  c.id,
  c.org_id,
  c.project_id,
  c.sha,
  c.description,
  c.no_task,
  coalesce((select array_agg(t.task_key order by t.task_key) from public.commit_tasks t where t.commit_id = c.id), '{}') as tasks,
  case
    when exists (select 1 from public.commit_tasks t where t.commit_id = c.id) then 'linked'
    when c.no_task then 'no_task'
    else 'pending'
  end as link_status,
  min(d.deployed_on) filter (where d.environment = 'staging') as first_staging_on,
  min(d.deployed_on) filter (where d.environment = 'production') as first_production_on,
  max(d.deployed_on) as last_deployed_on
from public.commits c
left join public.deployment_commits dc on dc.commit_id = c.id
left join public.deployments d on d.id = dc.deployment_id
group by c.id;

-- ============================================================
-- RLS e grants
-- ============================================================
alter table public.pull_requests enable row level security;
alter table public.pull_request_tasks enable row level security;
alter table public.commits enable row level security;
alter table public.commit_tasks enable row level security;
alter table public.deployment_pull_requests enable row level security;
alter table public.deployment_commits enable row level security;

create policy "membros veem PRs" on public.pull_requests
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve cria PRs" on public.pull_requests
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve edita PRs" on public.pull_requests
  for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "quem escreve apaga PRs" on public.pull_requests
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem tasks de PR" on public.pull_request_tasks
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve liga tasks a PR" on public.pull_request_tasks
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve desliga tasks de PR" on public.pull_request_tasks
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem commits" on public.commits
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve cria commits" on public.commits
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve edita commits" on public.commits
  for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "quem escreve apaga commits" on public.commits
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem tasks de commit" on public.commit_tasks
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve liga tasks a commit" on public.commit_tasks
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve desliga tasks de commit" on public.commit_tasks
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem PRs do deploy" on public.deployment_pull_requests
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve liga PR ao deploy" on public.deployment_pull_requests
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve desliga PR do deploy" on public.deployment_pull_requests
  for delete to authenticated using (public.can_write(org_id));

create policy "membros veem commits do deploy" on public.deployment_commits
  for select to authenticated using (public.is_org_member(org_id));
create policy "quem escreve liga commit ao deploy" on public.deployment_commits
  for insert to authenticated with check (public.can_write(org_id));
create policy "quem escreve desliga commit do deploy" on public.deployment_commits
  for delete to authenticated using (public.can_write(org_id));

revoke all on public.pull_requests, public.pull_request_tasks, public.commits, public.commit_tasks,
  public.deployment_pull_requests, public.deployment_commits, public.pull_request_summary, public.commit_summary from anon, authenticated;

grant select, insert, update, delete on public.pull_requests to authenticated;
grant select, insert, delete on public.pull_request_tasks to authenticated;
grant select, insert, update, delete on public.commits to authenticated;
grant select, insert, delete on public.commit_tasks to authenticated;
grant select, insert, delete on public.deployment_pull_requests to authenticated;
grant select, insert, delete on public.deployment_commits to authenticated;
grant select on public.pull_request_summary to authenticated;
grant select on public.commit_summary to authenticated;

revoke execute on function public.link_pull_request(uuid, text[], boolean, text) from public, anon;
revoke execute on function public.link_commit(uuid, text[], boolean, text) from public, anon;
grant execute on function public.link_pull_request(uuid, text[], boolean, text) to authenticated;
grant execute on function public.link_commit(uuid, text[], boolean, text) to authenticated;
