-- PR que leva metadados para importar no Business Manager: flag + caminho do import, por PR em cada deploy.
-- Idempotente: pode ser rodada de novo, inclusive por quem já aplicou a primeira versão (metadados no deploy).

-- 1. Colunas na ligação deploy-PR. O mesmo PR em outro deploy não herda a marcação.
alter table public.deployment_pull_requests
  add column if not exists has_metadata_import boolean not null default false,
  add column if not exists metadata_import_path text check (char_length(metadata_import_path) <= 500);

alter table public.deployment_pull_requests drop constraint if exists deployment_pull_requests_metadata_path_requires_flag;
-- O caminho só faz sentido quando o PR está marcado.
alter table public.deployment_pull_requests
  add constraint deployment_pull_requests_metadata_path_requires_flag check (metadata_import_path is null or has_metadata_import);

-- 2. Funções de gravação. As duas primeiras voltam ao formato original (sem metadados no deploy); a terceira grava a marcação de cada PR.
create or replace function public._insert_deployment(p_org uuid, p jsonb, p_batch uuid)
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

create or replace function public.save_deployment(p_org uuid, p_id uuid, p jsonb)
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

-- Gravação dos filhos do deploy: link_mode "replace" (formulário) redefine as tasks do PR; "merge" (importação) só acrescenta.
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

    insert into public.deployment_pull_requests (deployment_id, org_id, pull_request_id, has_metadata_import, metadata_import_path)
    values (
      p_id, p_org, v_ref,
      coalesce((v_item ->> 'has_metadata_import')::boolean, false),
      case when coalesce((v_item ->> 'has_metadata_import')::boolean, false) then nullif(btrim(v_item ->> 'metadata_import_path'), '') end
    )
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

-- 3. Limpeza da primeira versão desta migration, que guardava a marcação no deploy.
alter table public.deployments drop constraint if exists deployments_metadata_path_requires_flag;
alter table public.deployments drop column if exists metadata_import_path;
alter table public.deployments drop column if exists has_metadata_import;

-- 4. Grants explícitos. O da tabela já cobre as colunas novas; os das funções são refeitos por clareza (as assinaturas não mudaram).
grant select, insert, delete on public.deployment_pull_requests to authenticated;
grant execute on function public._insert_deployment(uuid, jsonb, uuid) to authenticated;
grant execute on function public._insert_deployment_children(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_deployment(uuid, uuid, jsonb) to authenticated;
